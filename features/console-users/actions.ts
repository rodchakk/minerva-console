"use server";

import "server-only";
import type { User } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireConsoleOwner } from "@/features/auth/consoleAccess";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getConsoleInviteRedirectUrl,
  INVITE_DEFAULT_ROLE,
  normalizeConsoleEmail,
  normalizeDisplayName,
  parseConsoleRole,
  parseConsoleStatus,
  parseUserId,
  type ConsoleMemberRow,
} from "@/features/console-users/model";

const AUTH_USER_LOOKUP_PAGE_SIZE = 1000;

async function findAuthUserByExactEmail(email: string) {
  const adminSupabase = createAdminClient();
  let page = 1;

  while (true) {
    const { data, error } = await adminSupabase.auth.admin.listUsers({
      page,
      perPage: AUTH_USER_LOOKUP_PAGE_SIZE,
    });

    if (error) {
      throw new Error("Auth users could not be checked safely.");
    }

    const users = data.users ?? [];
    const match = users.find((user) => user.email?.toLowerCase() === email) ?? null;

    if (match || !data.nextPage || users.length === 0) {
      return match;
    }

    page = data.nextPage;
  }
}

async function getConsoleMember(userId: string) {
  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase
    .from("console_members")
    .select("user_id,role,status,display_name,created_at,updated_at,created_by")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Console member could not be loaded.");
  }

  return data as ConsoleMemberRow | null;
}

async function hasOtherActiveConsoleOwner(userId: string) {
  const adminSupabase = createAdminClient();
  const { count, error } = await adminSupabase
    .from("console_members")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "owner")
    .eq("status", "active")
    .neq("user_id", userId);

  if (error) {
    throw new Error("Console owner safety could not be verified.");
  }

  return (count ?? 0) > 0;
}

function requireEditableConsoleMember(currentOwner: Awaited<ReturnType<typeof requireConsoleOwner>>, userId: string) {
  if (currentOwner.source === "superadmin" && currentOwner.user.id === userId) {
    throw new Error("System owner compatibility users cannot be edited here.");
  }
}

async function ensureOwnerSafety({
  currentOwner,
  nextRole,
  nextStatus,
  targetUserId,
}: {
  currentOwner: Awaited<ReturnType<typeof requireConsoleOwner>>;
  nextRole: "owner" | "builder" | "viewer";
  nextStatus: "active" | "disabled";
  targetUserId: string;
}) {
  if (currentOwner.source === "superadmin") {
    return;
  }

  if (targetUserId !== currentOwner.user.id) {
    return;
  }

  if (nextRole === "owner" && nextStatus === "active") {
    return;
  }

  if (!(await hasOtherActiveConsoleOwner(targetUserId))) {
    throw new Error("You cannot remove the final effective Console owner.");
  }
}

async function upsertConsoleMembership({
  createdBy,
  displayName,
  role,
  userId,
}: {
  createdBy: string;
  displayName: string | null;
  role: "owner" | "builder" | "viewer";
  userId: string;
}) {
  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from("console_members")
    .upsert(
      {
        created_by: createdBy,
        display_name: displayName,
        role,
        status: "active",
        user_id: userId,
      },
      { onConflict: "user_id" },
    );

  if (error) {
    throw new Error("Console membership could not be saved.");
  }
}

export async function inviteConsoleUserAction(formData: FormData) {
  const currentOwner = await requireConsoleOwner();
  const adminSupabase = createAdminClient();
  const email = normalizeConsoleEmail(formData.get("email"));
  const role = parseConsoleRole(formData.get("role")) ?? INVITE_DEFAULT_ROLE;
  const displayName = normalizeDisplayName(formData.get("displayName"));

  if (!email) {
    throw new Error("Enter a valid email address.");
  }

  if (!parseConsoleRole(formData.get("role"))) {
    throw new Error("Choose a valid Console role.");
  }

  let existingAuthUser: User | null;

  try {
    existingAuthUser = await findAuthUserByExactEmail(email);
  } catch (error) {
    console.error("[console-users] exact email lookup failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    throw new Error("We could not safely check that email right now.");
  }

  if (existingAuthUser) {
    await upsertConsoleMembership({
      createdBy: currentOwner.user.id,
      displayName,
      role,
      userId: existingAuthUser.id,
    });
    revalidatePath("/users");
    redirect("/users?result=existing");
  }

  let invitedUserId: string | null = null;

  try {
    const { data, error } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
      data: displayName ? { display_name: displayName } : undefined,
      redirectTo: getConsoleInviteRedirectUrl(),
    });

    if (error || !data.user) {
      throw new Error(error?.message ?? "The invitation could not be created.");
    }

    invitedUserId = data.user.id;
    await upsertConsoleMembership({
      createdBy: currentOwner.user.id,
      displayName,
      role,
      userId: data.user.id,
    });
  } catch (error) {
    if (invitedUserId) {
      const { error: cleanupError } =
        await adminSupabase.auth.admin.deleteUser(invitedUserId, true);

      if (cleanupError) {
        console.error("[console-users] invite rollback cleanup failed", {
          code: cleanupError.code,
          status: cleanupError.status,
          userId: invitedUserId,
        });
      }
    }

    console.error("[console-users] invitation failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    throw new Error("The invitation could not be completed safely.");
  }

  revalidatePath("/users");
  redirect("/users?result=invited");
}

export async function updateConsoleMemberRoleAction(formData: FormData) {
  const currentOwner = await requireConsoleOwner();
  const adminSupabase = createAdminClient();
  const userId = parseUserId(formData.get("userId"));
  const role = parseConsoleRole(formData.get("role"));

  if (!userId || !role) {
    throw new Error("Invalid Console member role update.");
  }

  requireEditableConsoleMember(currentOwner, userId);

  const member = await getConsoleMember(userId);
  if (!member) {
    throw new Error("Console member not found.");
  }

  await ensureOwnerSafety({
    currentOwner,
    nextRole: role,
    nextStatus: member.status,
    targetUserId: userId,
  });

  const { error } = await adminSupabase
    .from("console_members")
    .update({ role })
    .eq("user_id", userId);

  if (error) {
    throw new Error("Console member role could not be updated.");
  }

  revalidatePath("/users");
}

export async function updateConsoleMemberStatusAction(formData: FormData) {
  const currentOwner = await requireConsoleOwner();
  const adminSupabase = createAdminClient();
  const userId = parseUserId(formData.get("userId"));
  const status = parseConsoleStatus(formData.get("status"));

  if (!userId || !status) {
    throw new Error("Invalid Console member status update.");
  }

  requireEditableConsoleMember(currentOwner, userId);

  const member = await getConsoleMember(userId);
  if (!member) {
    throw new Error("Console member not found.");
  }

  await ensureOwnerSafety({
    currentOwner,
    nextRole: member.role,
    nextStatus: status,
    targetUserId: userId,
  });

  const { error } = await adminSupabase
    .from("console_members")
    .update({ status })
    .eq("user_id", userId);

  if (error) {
    throw new Error("Console member status could not be updated.");
  }

  revalidatePath("/users");
}
