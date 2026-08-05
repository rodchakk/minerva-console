"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthActionState = {
  message?: string;
};

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { message: "Enter both email and password to continue." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { message: error.message };
  }

  const { data, error: roleError } = await supabase.rpc("is_superadmin");

  if (roleError) {
    console.error("[auth] superadmin authorization check failed after login", {
      code: roleError.code,
    });
    redirect("/unauthorized?reason=authorization_error");
  }

  redirect(data === true ? "/dashboard" : "/unauthorized");
}

export async function signOutAction() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error) {
    console.error("[auth] sign out failed", {
      name: error.name,
      status: error.status,
      code: error.code,
    });
    redirect("/unauthorized?reason=sign_out_error");
  }

  redirect("/login");
}
