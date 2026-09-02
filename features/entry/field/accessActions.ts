"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import {
  createGuardAction,
  type StaffActionState,
} from "@/features/entry/staff/actions";
import { createClient } from "@/lib/supabase/server";
import { coerceBoolean, coerceString } from "@/lib/supabase/utils";

export type FieldRoleActionState = {
  message?: string;
  ok?: boolean;
};

type EntryRole = "ADMIN" | "GUARD" | "RESIDENT" | "UNASSIGNED";
type MutableEntryRole = Exclude<EntryRole, "UNASSIGNED">;

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function normalizeRole(value: string): EntryRole | null {
  const normalized = value.trim().toUpperCase();

  if (
    normalized === "ADMIN" ||
    normalized === "GUARD" ||
    normalized === "RESIDENT" ||
    normalized === "UNASSIGNED"
  ) {
    return normalized;
  }

  return null;
}

function normalizeMutableRole(value: string): MutableEntryRole | null {
  const role = normalizeRole(value);
  return role && role !== "UNASSIGNED" ? role : null;
}

function revalidateFieldAccessPaths(communityId: string, userId?: string) {
  revalidatePath("/field/entry/access");
  revalidatePath("/field/entry/people");
  revalidatePath(`/field/entry/communities/${communityId}`);
  revalidatePath(`/field/entry/communities/${communityId}/people`);
  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/staff`);
  revalidatePath(`/products/entry/communities/${communityId}/users`);

  if (userId) {
    revalidatePath(
      `/field/entry/access/roles/${encodeURIComponent(communityId)}/${encodeURIComponent(userId)}`,
    );
    revalidatePath(
      `/field/entry/communities/${encodeURIComponent(communityId)}/people/residents/${encodeURIComponent(userId)}`,
    );
  }
}

export async function createFieldGuardAction(
  previousState: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const result = await createGuardAction(previousState, formData);

  if (result.ok) {
    const communityId = getString(formData, "communityId");
    if (communityId) {
      revalidateFieldAccessPaths(communityId);
    }
  }

  return result;
}

export async function changeFieldUserRoleAction(
  _previousState: FieldRoleActionState,
  formData: FormData,
): Promise<FieldRoleActionState> {
  const { user: actor } = await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { ok: false, message: previewReadOnlyError };
  }

  const communityId = getString(formData, "communityId");
  const userId = getString(formData, "userId");
  const requestedRole = normalizeMutableRole(getString(formData, "role"));
  const requestedHouseId = getString(formData, "houseId");

  if (!communityId || !userId || !requestedRole) {
    return {
      ok: false,
      message: "Community, user and a valid role are required.",
    };
  }

  if (userId === actor.id) {
    return {
      ok: false,
      message: "Your own Field role is protected and cannot be changed here.",
    };
  }

  const supabase = await createClient();
  const { data: targetIsSystemOwner, error: systemOwnerError } = await supabase.rpc(
    "is_superadmin",
    { p_user_id: userId },
  );

  if (systemOwnerError) {
    return {
      ok: false,
      message: "Could not verify protected system-owner status. No role was changed.",
    };
  }

  if (targetIsSystemOwner === true) {
    return {
      ok: false,
      message: "Protected Minerva system owner accounts cannot be changed from Field.",
    };
  }

  const { data: users, error: usersError } = await supabase.rpc(
    "sa_list_community_users",
    {
      p_community_id: communityId,
      p_include_inactive: true,
    },
  );

  if (usersError || !Array.isArray(users)) {
    return {
      ok: false,
      message: usersError?.message ?? "Could not validate the selected ENTRY user.",
    };
  }

  const target = users
    .map((item) => item as Record<string, unknown>)
    .find((item) => {
      const id = coerceString(item.user_id) || coerceString(item.id);
      return id === userId;
    });

  if (!target) {
    return {
      ok: false,
      message: "The selected user is not part of this community.",
    };
  }

  const currentRole = normalizeRole(coerceString(target.role));
  if (!currentRole) {
    return {
      ok: false,
      message: "The selected user has an unsupported ENTRY role.",
    };
  }

  if (currentRole === requestedRole) {
    return {
      ok: true,
      message: `${coerceString(target.full_name, "User")} is already ${requestedRole}.`,
    };
  }

  const currentHouseId =
    coerceString(target.house_id) || coerceString(target.unit_id);
  let residentHouseId = currentHouseId;

  if (requestedRole === "RESIDENT" && !residentHouseId) {
    if (currentRole === "UNASSIGNED") {
      return {
        ok: false,
        message:
          "Assign this unassigned account through People before converting it to Resident.",
      };
    }

    if (!requestedHouseId) {
      return {
        ok: false,
        message: "Select a unit before changing this account to Resident.",
      };
    }

    const { data: house, error: houseError } = await supabase
      .from("houses")
      .select("id,is_active")
      .eq("id", requestedHouseId)
      .eq("community_id", communityId)
      .maybeSingle();

    if (houseError || !house || house.is_active !== true) {
      return {
        ok: false,
        message: "Select an active unit from this community.",
      };
    }

    residentHouseId = requestedHouseId;
  }

  const { error: roleError } = await supabase.rpc("sa_change_user_role", {
    p_community_id: communityId,
    p_new_role: requestedRole,
    p_user_id: userId,
  });

  if (roleError) {
    return { ok: false, message: roleError.message };
  }

  if (requestedRole === "RESIDENT" && !currentHouseId && residentHouseId) {
    const { error: assignmentError } = await supabase.rpc(
      "sa_update_community_user",
      {
        p_community_id: communityId,
        p_full_name: coerceString(target.full_name, "Unnamed user"),
        p_house_id: residentHouseId,
        p_is_active: coerceBoolean(target.is_active),
        p_phone: coerceString(target.phone) || null,
        p_target_user_id: userId,
      },
    );

    if (assignmentError) {
      if (currentRole === "ADMIN" || currentRole === "GUARD" || currentRole === "RESIDENT") {
        await supabase.rpc("sa_change_user_role", {
          p_community_id: communityId,
          p_new_role: currentRole,
          p_user_id: userId,
        });
      }

      return {
        ok: false,
        message: `${assignmentError.message} The role change was rolled back.`,
      };
    }
  }

  revalidateFieldAccessPaths(communityId, userId);

  const name = coerceString(target.full_name, "User");
  const detail =
    requestedRole === "GUARD"
      ? " The previous unit assignment was removed."
      : requestedRole === "RESIDENT" && !currentHouseId
        ? " The selected unit was assigned."
        : "";

  return {
    ok: true,
    message: `${name} is now ${requestedRole}.${detail}`,
  };
}
