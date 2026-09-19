import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

type AdminClient = ReturnType<typeof createClient>;

async function logAuthSystemFailure(
  admin: AdminClient,
  input: {
    communityId?: string | null;
    userId?: string | null;
    errorCode: string;
    startedAt: number;
  },
) {
  try {
    await admin.from("system_event_log").insert({
      severity: "ERROR",
      module: "authentication",
      event_type: "AUTH_LOGIN_FAILED",
      message: "ENTRY username authentication experienced a system failure",
      details: {
        status: "failed",
        error_code: input.errorCode,
        error_fingerprint: `authentication:username:${input.errorCode.toLowerCase()}`,
        duration_ms: Math.max(0, Date.now() - input.startedAt),
      },
      community_id: input.communityId ?? null,
      user_id: input.userId ?? null,
      source: "login-with-username",
    });
  } catch {
    // Authentication must never fail harder because telemetry is unavailable.
  }
}

Deno.serve(async (req) => {
  const startedAt = Date.now();

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!URL || !SRK || !ANON) {
    return json({ ok: false, error: "env_missing" }, 500);
  }

  const admin = createClient(URL, SRK, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: { username?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  const username = (body.username ?? "").toLowerCase().trim();
  const password = body.password ?? "";

  if (!username || !password) {
    return json({ ok: false, error: "missing_fields" }, 400);
  }

  const { data: p, error: profileError } = await admin
    .from("profiles")
    .select("user_id, community_id, auth_type, is_active, username_login_enabled, pin_must_change, synthetic_email, failed_pin_attempts, locked_until")
    .eq("username", username)
    .maybeSingle();

  if (profileError) {
    await logAuthSystemFailure(admin, {
      errorCode: "AUTH_PROFILE_LOOKUP_FAILED",
      startedAt,
    });
    return json({ ok: false, error: "authentication_unavailable" }, 503);
  }

  if (!p || !p.is_active || p.auth_type !== "username") {
    return json({ ok: false, error: "invalid_credentials" }, 401);
  }
  if (!p.username_login_enabled) {
    return json({ ok: false, error: "username_login_disabled" }, 403);
  }
  if (p.pin_must_change) {
    return json({ ok: false, error: "account_not_activated" }, 403);
  }
  if (p.locked_until && new Date(p.locked_until) > new Date()) {
    return json({ ok: false, error: "account_locked", unlock_at: p.locked_until }, 429);
  }
  if (!p.synthetic_email) {
    await logAuthSystemFailure(admin, {
      communityId: p.community_id,
      userId: p.user_id,
      errorCode: "AUTH_SYNTHETIC_IDENTITY_MISSING",
      startedAt,
    });
    return json({ ok: false, error: "authentication_unavailable" }, 503);
  }

  let authRes: Response;
  try {
    authRes = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": ANON,
        "Authorization": `Bearer ${ANON}`,
      },
      body: JSON.stringify({ email: p.synthetic_email, password }),
    });
  } catch {
    await logAuthSystemFailure(admin, {
      communityId: p.community_id,
      userId: p.user_id,
      errorCode: "AUTH_PROVIDER_NETWORK_ERROR",
      startedAt,
    });
    return json({ ok: false, error: "authentication_unavailable" }, 503);
  }

  let authData: Record<string, unknown> = {};
  try {
    const parsed = await authRes.json();
    authData = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    await logAuthSystemFailure(admin, {
      communityId: p.community_id,
      userId: p.user_id,
      errorCode: "AUTH_PROVIDER_INVALID_RESPONSE",
      startedAt,
    });
    return json({ ok: false, error: "authentication_unavailable" }, 503);
  }

  if (!authRes.ok || typeof authData.access_token !== "string") {
    if (authRes.status >= 500) {
      await logAuthSystemFailure(admin, {
        communityId: p.community_id,
        userId: p.user_id,
        errorCode: `AUTH_PROVIDER_HTTP_${authRes.status}`,
        startedAt,
      });
      return json({ ok: false, error: "authentication_unavailable" }, 503);
    }

    const attempts = (p.failed_pin_attempts ?? 0) + 1;
    const lockUntil =
      attempts >= MAX_ATTEMPTS
        ? new Date(Date.now() + LOCK_MS).toISOString()
        : null;

    await admin
      .from("profiles")
      .update({ failed_pin_attempts: attempts, locked_until: lockUntil })
      .eq("user_id", p.user_id);

    return json({ ok: false, error: "invalid_credentials" }, 401);
  }

  const { error: resetError } = await admin
    .from("profiles")
    .update({ failed_pin_attempts: 0, locked_until: null })
    .eq("user_id", p.user_id);

  if (resetError) {
    await logAuthSystemFailure(admin, {
      communityId: p.community_id,
      userId: p.user_id,
      errorCode: "AUTH_LOGIN_STATE_RESET_FAILED",
      startedAt,
    });
  }

  const session = {
    access_token: authData.access_token,
    refresh_token: authData.refresh_token,
    expires_in: authData.expires_in,
    expires_at: authData.expires_at,
    token_type: authData.token_type ?? "bearer",
    user: authData.user,
  };

  return json({ ok: true, session }, 200);
});
