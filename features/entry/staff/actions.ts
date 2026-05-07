"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  coerceBoolean,
  coerceString,
} from "@/lib/supabase/utils";

export type StaffUserItem = {
  contact: string;
  fullName: string;
  houseId: string;
  houseLabel: string;
  id: string;
  isActive: boolean;
  role: string;
};

export type CommunityStaffPageData = {
  admins: StaffUserItem[];
  guards: StaffUserItem[];
  residents: StaffUserItem[];
};

export type StaffActionState = {
  message?: string;
  ok?: boolean;
};

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getPreferredContact(record: Record<string, unknown>) {
  const email = coerceString(record.email).trim();
  const username = coerceString(record.username).trim();

  if (email && !email.toLowerCase().endsWith("@entry.local")) {
    return email;
  }

  if (username) {
    return username;
  }

  return email || "No contact available";
}

function mapStaffUser(record: Record<string, unknown>): StaffUserItem {
  return {
    contact: getPreferredContact(record),
    fullName: coerceString(record.full_name, "Unnamed user"),
    houseId: coerceString(record.house_id),
    houseLabel: coerceString(record.house_label, "No unit linked"),
    id: coerceString(record.user_id),
    isActive: coerceBoolean(record.is_active),
    role: coerceString(record.role, "Unknown"),
  };
}

export async function getCommunityStaffPageData(
  communityId: string,
): Promise<CommunityStaffPageData> {
  await requireSuperadmin();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sa_list_users", {
    p_community_id: communityId,
    p_search: null,
  });

  if (error || !Array.isArray(data)) {
    return {
      admins: [],
      guards: [],
      residents: [],
    };
  }

  const users = data
    .map((item) => mapStaffUser(item as Record<string, unknown>))
    .filter((item) => item.id && item.isActive);

  return {
    admins: users.filter((item) => item.role.toUpperCase() === "ADMIN"),
    guards: users.filter((item) => item.role.toUpperCase() === "GUARD"),
    residents: users.filter((item) => item.role.toUpperCase() === "RESIDENT"),
  };
}

export async function promoteResidentAdminAction(
  _previousState: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  await requireSuperadmin();

  const communityId = getString(formData, "communityId");
  const userId = getString(formData, "userId");

  if (!communityId || !userId) {
    return {
      ok: false,
      message: "Select an active resident to promote.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("sa_change_user_role", {
    p_user_id: userId,
    p_community_id: communityId,
    p_new_role: "ADMIN",
  });

  if (error) {
    return {
      ok: false,
      message: error.message,
    };
  }

  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/staff`);

  return {
    ok: true,
    message: "Resident admin assigned successfully.",
  };
}

export async function createGuardAction(
  _previousState: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  await requireSuperadmin();

  const communityId = getString(formData, "communityId");
  const fullName = getString(formData, "fullName");
  const email = getString(formData, "email").toLowerCase();
  const phone = getString(formData, "phone");
  const description = getString(formData, "description");
  const password = getString(formData, "password");
  const accountType = getString(formData, "accountType") || "individual";

  if (!communityId || !fullName || !email || !password) {
    return {
      ok: false,
      message: "Guard name, email and temporary password are required.",
    };
  }

  if (password.length < 8) {
    return {
      ok: false,
      message: "Temporary password must be at least 8 characters.",
    };
  }

  const adminSupabase = createAdminClient();
  const { data: createdUser, error: createError } =
    await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        entry_role: "GUARD",
        guard_account_type: accountType,
        guard_description: description || null,
      },
    });

  if (createError || !createdUser.user) {
    return {
      ok: false,
      message: createError?.message ?? "Could not create guard auth user.",
    };
  }

  const supabase = await createClient();
  const { error: setupError } = await supabase.rpc("sa_setup_user_profile", {
    p_user_id: createdUser.user.id,
    p_community_id: communityId,
    p_full_name: fullName,
    p_role: "GUARD",
    p_house_id: null,
    p_phone: phone || null,
  });

  if (setupError) {
    return {
      ok: false,
      message: setupError.message,
    };
  }

  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/staff`);

  return {
    ok: true,
    message:
      accountType === "shared"
        ? "Shared guard account created successfully."
        : "Guard account created successfully.",
  };
}
