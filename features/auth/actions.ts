"use server";

import { redirect } from "next/navigation";
import {
  getConsolePostLoginDestination,
} from "@/features/auth/postLoginDestination";
import { getConsoleAccessContext } from "@/features/auth/consoleAccess";
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

  const context = await getConsoleAccessContext();

  if (context.status === "authorization_error") {
    redirect("/unauthorized?reason=authorization_error");
  }

  if (context.status !== "authorized") {
    redirect("/unauthorized");
  }

  redirect(getConsolePostLoginDestination(context.role, formData.get("next")));
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

export async function updateConsolePasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    return { message: "Use at least 8 characters for your password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { message: error.message };
  }

  const context = await getConsoleAccessContext();

  if (context.status === "authorization_error") {
    redirect("/unauthorized?reason=authorization_error");
  }

  if (context.status !== "authorized") {
    redirect("/unauthorized");
  }

  redirect(getConsolePostLoginDestination(context.role, null));
}
