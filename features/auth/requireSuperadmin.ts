import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthContext = {
  isSuperadmin: boolean;
  user: {
    email: string | null;
    id: string;
  } | null;
};

export const getAuthContext = cache(async (): Promise<AuthContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      isSuperadmin: false,
    };
  }

  const { data, error } = await supabase.rpc("is_superadmin");

  return {
    user: {
      email: user.email ?? null,
      id: user.id,
    },
    isSuperadmin: !error && data === true,
  };
});

export async function requireSuperadmin() {
  const context = await getAuthContext();

  if (!context.user) {
    redirect("/login");
  }

  if (!context.isSuperadmin) {
    redirect("/unauthorized");
  }

  return {
    isSuperadmin: true as const,
    user: context.user as NonNullable<AuthContext["user"]>,
  };
}
