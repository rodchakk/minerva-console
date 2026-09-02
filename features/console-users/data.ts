import "server-only";
import type { User } from "@supabase/supabase-js";
import { requireConsoleOwner } from "@/features/auth/consoleAccess";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAccountState,
  type ConsoleMemberRow,
  type ConsoleUserListItem,
} from "@/features/console-users/model";

async function listAuthUsersById(userIds: string[]) {
  const adminSupabase = createAdminClient();
  const pairs = await Promise.all(
    userIds.map(async (userId) => {
      const { data, error } = await adminSupabase.auth.admin.getUserById(userId);

      if (error) {
        console.error("[console-users] auth user lookup failed", {
          code: error.code,
          status: error.status,
          userId,
        });
      }

      return [userId, data.user] as const;
    }),
  );

  return new Map<string, User | null>(pairs);
}

export async function getConsoleUsersPageData(): Promise<ConsoleUserListItem[]> {
  const currentOwner = await requireConsoleOwner();
  const adminSupabase = createAdminClient();

  const { data: members, error } = await adminSupabase
    .from("console_members")
    .select("user_id,role,status,display_name,created_at,updated_at,created_by")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Console members could not be loaded.");
  }

  const memberRows = (members ?? []) as ConsoleMemberRow[];
  const userIds = memberRows.map((member) => member.user_id);
  
  // Add currentOwner if not present
  if (currentOwner.source === "superadmin" && !userIds.includes(currentOwner.user.id)) {
    userIds.push(currentOwner.user.id);
  }

  const authUsers = await listAuthUsersById(userIds);
  const superadminChecks = await Promise.all(
    userIds.map(async (userId) => {
      const { data, error } = await adminSupabase.rpc("is_superadmin", { p_user_id: userId });
      
      if (error) {
        console.error("[console-users] batch superadmin check failed", { code: error.code });
        throw new Error("Target user compatibility could not be verified safely.");
      }
      
      return [userId, data === true] as const;
    })
  );
  const superadminMap = new Map(superadminChecks);

  const items: ConsoleUserListItem[] = [];

  for (const member of memberRows) {
    const authUser = authUsers.get(member.user_id) ?? null;
    const isSuperadmin = superadminMap.get(member.user_id) ?? false;

    if (isSuperadmin) {
      items.push({
        accountState: getAccountState(authUser),
        createdAt: member.created_at,
        displayName: member.display_name,
        email: authUser?.email ?? null,
        isEditable: false,
        role: "owner",
        source: "System owner",
        status: "active",
        userId: member.user_id,
      });
    } else {
      items.push({
        accountState: getAccountState(authUser),
        createdAt: member.created_at,
        displayName: member.display_name,
        email: authUser?.email ?? null,
        isEditable: true,
        role: member.role,
        source: "Console member",
        status: member.status,
        userId: member.user_id,
      });
    }
  }

  if (
    currentOwner.source === "superadmin" &&
    !items.some((item) => item.userId === currentOwner.user.id)
  ) {
    items.unshift({
      accountState: "Active",
      createdAt: "",
      displayName: null,
      email: currentOwner.user.email,
      isEditable: false,
      role: "owner",
      source: "System owner",
      status: "active",
      userId: currentOwner.user.id,
    });
  }

  return items;
}
