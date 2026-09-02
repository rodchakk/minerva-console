import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const CONSOLE_ROLES = ["owner", "builder", "viewer"] as const;
export const CONSOLE_MEMBER_STATUSES = ["active", "disabled"] as const;

export type ConsoleRole = (typeof CONSOLE_ROLES)[number];
export type ConsoleMemberStatus = (typeof CONSOLE_MEMBER_STATUSES)[number];
export type ConsoleAccessSource = "superadmin" | "console_members";

export type ConsoleAccessUser = {
  email: string | null;
  id: string;
};

export type ConsoleAccessContext =
  | {
      status: "unauthenticated";
      role: null;
      source: null;
      user: null;
    }
  | {
      status: "authorized";
      role: ConsoleRole;
      memberStatus: "active";
      source: ConsoleAccessSource;
      user: ConsoleAccessUser;
    }
  | {
      status: "forbidden";
      role: ConsoleRole | null;
      memberStatus: ConsoleMemberStatus | "missing" | null;
      source: ConsoleAccessSource | null;
      user: ConsoleAccessUser;
    }
  | {
      status: "authorization_error";
      role: null;
      source: null;
      user: ConsoleAccessUser;
    };

type ConsoleAccessRpcRow = {
  is_superadmin?: unknown;
  role?: unknown;
  source?: unknown;
  status?: unknown;
  user_id?: unknown;
};

function isConsoleRole(value: unknown): value is ConsoleRole {
  return typeof value === "string" && CONSOLE_ROLES.includes(value as ConsoleRole);
}

function isConsoleMemberStatus(value: unknown): value is ConsoleMemberStatus {
  return (
    typeof value === "string" &&
    CONSOLE_MEMBER_STATUSES.includes(value as ConsoleMemberStatus)
  );
}

function isConsoleAccessSource(value: unknown): value is ConsoleAccessSource {
  return value === "superadmin" || value === "console_members";
}

function firstRpcRow(data: unknown): ConsoleAccessRpcRow | null {
  if (Array.isArray(data)) {
    return (data[0] ?? null) as ConsoleAccessRpcRow | null;
  }

  return (data ?? null) as ConsoleAccessRpcRow | null;
}

export const getConsoleAccessContext = cache(
  async (): Promise<ConsoleAccessContext> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        status: "unauthenticated",
        role: null,
        source: null,
        user: null,
      };
    }

    const userContext = {
      email: user.email ?? null,
      id: user.id,
    };

    const { data, error } = await supabase.rpc("get_console_access_context_v1");

    if (error) {
      console.error("[auth] Console access check failed", {
        userId: user.id,
        code: error.code,
      });
      return {
        status: "authorization_error",
        role: null,
        source: null,
        user: userContext,
      };
    }

    const row = firstRpcRow(data);

    if (
      row?.is_superadmin === true &&
      row.role === "owner" &&
      row.status === "active" &&
      row.source === "superadmin"
    ) {
      return {
        status: "authorized",
        role: "owner",
        memberStatus: "active",
        source: "superadmin",
        user: userContext,
      };
    }

    const role = isConsoleRole(row?.role) ? row.role : null;
    const memberStatus = isConsoleMemberStatus(row?.status)
      ? row.status
      : row?.status === "missing"
        ? "missing"
        : null;
    const source = isConsoleAccessSource(row?.source) ? row.source : null;

    if (role && memberStatus === "active" && source === "console_members") {
      return {
        status: "authorized",
        role,
        memberStatus,
        source,
        user: userContext,
      };
    }

    return {
      status: "forbidden",
      role,
      memberStatus,
      source,
      user: userContext,
    };
  },
);

export async function requireConsoleMember() {
  const context = await getConsoleAccessContext();

  if (context.status === "unauthenticated") {
    redirect("/login");
  }

  if (context.status === "authorization_error") {
    redirect("/unauthorized?reason=authorization_error");
  }

  if (context.status !== "authorized") {
    redirect("/unauthorized");
  }

  return {
    role: context.role,
    source: context.source,
    user: context.user,
  };
}

export async function requireConsoleOwner() {
  const context = await getConsoleAccessContext();

  if (context.status === "unauthenticated") {
    redirect("/login");
  }

  if (context.status === "authorization_error") {
    redirect("/unauthorized?reason=authorization_error");
  }

  if (context.status !== "authorized" || context.role !== "owner") {
    redirect("/unauthorized");
  }

  return {
    role: "owner" as const,
    source: context.source,
    user: context.user,
  };
}
