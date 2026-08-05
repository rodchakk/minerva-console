import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthContextStatus =
  | "unauthenticated"
  | "authorized"
  | "forbidden"
  | "authorization_error";

export type AuthUser = {
  email: string | null;
  id: string;
};

export type AuthContext =
  | {
      status: "unauthenticated";
      isSuperadmin: false;
      user: null;
    }
  | {
      status: "authorized";
      isSuperadmin: true;
      user: AuthUser;
    }
  | {
      status: "forbidden";
      isSuperadmin: false;
      user: AuthUser;
    }
  | {
      status: "authorization_error";
      isSuperadmin: false;
      user: AuthUser;
    };

export const getAuthContext = cache(async (): Promise<AuthContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "unauthenticated",
      user: null,
      isSuperadmin: false,
    };
  }

  const { data, error } = await supabase.rpc("is_superadmin");

  if (error) {
    console.error("[auth] superadmin authorization check failed", {
      userId: user.id,
      code: error.code,
    });
    return {
      status: "authorization_error",
      user: {
        email: user.email ?? null,
        id: user.id,
      },
      isSuperadmin: false,
    };
  }

  const userContext = {
    email: user.email ?? null,
    id: user.id,
  };

  if (data === true) {
    return {
      status: "authorized",
      user: userContext,
      isSuperadmin: true,
    };
  }

  return {
    status: "forbidden",
    user: userContext,
    isSuperadmin: false,
  };
});

export async function requireSuperadmin() {
  const context = await getAuthContext();

  if (context.status === "unauthenticated") {
    redirect("/login");
  }

  if (context.status === "authorization_error") {
    redirect("/unauthorized?reason=authorization_error");
  }

  if (context.status === "forbidden" || !context.isSuperadmin) {
    redirect("/unauthorized");
  }

  return {
    isSuperadmin: true as const,
    user: context.user as NonNullable<AuthContext["user"]>,
  };
}
