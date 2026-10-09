"use client";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let client: SupabaseClient<Database> | null = null;

export type SeshatDataError = {
  code?: string;
  details?: string;
  message?: string;
};

export type SeshatDataResult<T = unknown> = {
  data: T | null;
  error: SeshatDataError | null;
};

export type SeshatQuery<T = unknown> = PromiseLike<SeshatDataResult<T>> & {
  delete(): SeshatQuery<T>;
  eq(column: string, value: unknown): SeshatQuery<T>;
  insert(values: Record<string, unknown> | Array<Record<string, unknown>>): SeshatQuery<T>;
  limit(count: number): SeshatQuery<T>;
  maybeSingle(): Promise<SeshatDataResult<T>>;
  order(column: string, options?: { ascending?: boolean }): SeshatQuery<T>;
  select(columns?: string): SeshatQuery<T>;
  single(): Promise<SeshatDataResult<T>>;
  update(values: Record<string, unknown>): SeshatQuery<T>;
};

export type SeshatDataClient = {
  from<T = unknown>(table: string): SeshatQuery<T>;
  rpc<T = unknown>(fn: string, args?: Record<string, unknown>): SeshatQuery<T>;
};

export function getSeshatConfig() {
  const url = process.env.NEXT_PUBLIC_SESHAT_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SESHAT_SUPABASE_ANON_KEY;
  return {
    configured: Boolean(url && anonKey),
    url,
    anonKey,
  };
}

export function assertSafeSeshatPublicConfig() {
  const { anonKey } = getSeshatConfig();
  if (anonKey && /service[_-]?role/i.test(anonKey)) {
    throw new Error("Refusing to initialize Seshat with a service-role-looking browser key.");
  }
}

export function getSeshatSupabase() {
  if (client) return client;

  const { url, anonKey } = getSeshatConfig();
  if (!url || !anonKey) {
    throw new Error("Seshat Supabase is not configured for this deployment.");
  }

  assertSafeSeshatPublicConfig();
  client = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "minerva-console-seshat-auth",
    },
  });
  return client;
}

export function getSeshatDataClient() {
  return getSeshatSupabase() as unknown as SeshatDataClient;
}
