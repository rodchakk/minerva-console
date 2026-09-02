import type { User } from "@supabase/supabase-js";
import type { ConsoleMemberStatus, ConsoleRole } from "@/features/auth/consoleAccess";

export const INVITE_DEFAULT_ROLE: ConsoleRole = "builder";
export const CONSOLE_INVITE_REDIRECT_PATH = "/auth/callback";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ConsoleMemberRow = {
  created_at: string;
  created_by: string | null;
  display_name: string | null;
  role: ConsoleRole;
  status: ConsoleMemberStatus;
  updated_at: string;
  user_id: string;
};

export type ConsoleUserListItem = {
  accountState: "Active" | "Invited";
  createdAt: string;
  displayName: string | null;
  email: string | null;
  isEditable: boolean;
  role: ConsoleRole;
  source: "Console member" | "System owner";
  status: ConsoleMemberStatus;
  userId: string;
};

export function normalizeConsoleEmail(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const email = value.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return null;
  }

  return email;
}

export function normalizeDisplayName(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const displayName = value.trim().replace(/\s+/g, " ");

  if (!displayName) {
    return null;
  }

  return displayName.slice(0, 120);
}

export function parseConsoleRole(value: FormDataEntryValue | string | null | undefined) {
  return value === "owner" || value === "builder" || value === "viewer"
    ? value
    : null;
}

export function parseConsoleStatus(value: FormDataEntryValue | string | null | undefined) {
  return value === "active" || value === "disabled" ? value : null;
}

export function parseUserId(value: FormDataEntryValue | string | null | undefined) {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

export function getConsoleInviteRedirectUrl() {
  const explicitBase = process.env.NEXT_PUBLIC_SITE_URL;
  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
  const localBase = process.env.NODE_ENV === "development" ? "http://localhost:3000" : null;
  const base = explicitBase ?? vercelUrl ?? localBase;

  if (!base) {
    throw new Error("Missing NEXT_PUBLIC_SITE_URL or VERCEL_URL for Console invitations.");
  }

  return new URL(CONSOLE_INVITE_REDIRECT_PATH, base).toString();
}

export function getAccountState(user: User | null | undefined) {
  return user?.last_sign_in_at || user?.confirmed_at ? "Active" : "Invited";
}
