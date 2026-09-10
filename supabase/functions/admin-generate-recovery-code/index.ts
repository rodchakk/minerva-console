// admin-generate-recovery-code v2
//
// Generates a temporary 6-digit recovery PIN for a username-only ENTRY user.
// The PIN is consumed by the existing password-recovery activation path.
//
// Security model:
//   - Caller must present a valid user JWT.
//   - Caller must be either a Minerva superadmin OR an active ADMIN of the
//     target community.
//   - Target must belong to that community and use username authentication.
//   - ADMIN targets and self-reset are rejected.
//   - Existing pending codes are expired before a replacement is generated.
//   - The plaintext PIN is returned once and is never written to logs.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function generateSixDigitCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String((buf[0] % 900_000) + 100_000);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return respond({ ok: false, error: "method_not_allowed" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("[admin-generate-recovery-code] missing env vars");
    return respond({ ok: false, error: "config_error" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return respond({ ok: false, error: "unauthorized" }, 401);

  let callerId: string | null = null;
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: ANON_KEY },
    });
    if (!userRes.ok) return respond({ ok: false, error: "unauthorized" }, 401);
    const userData = await userRes.json();
    callerId = userData?.id ?? null;
  } catch (error) {
    console.error(
      "[admin-generate-recovery-code] auth fetch failed:",
      String(error).slice(0, 80),
    );
    return respond({ ok: false, error: "auth_error" }, 500);
  }

  if (!callerId) return respond({ ok: false, error: "unauthorized" }, 401);

  let body: { target_user_id?: unknown; community_id?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return respond({ ok: false, error: "invalid_body" }, 400);
  }

  const targetUserId =
    typeof body.target_user_id === "string" ? body.target_user_id.trim() : "";
  const communityId =
    typeof body.community_id === "string" ? body.community_id.trim() : "";

  if (!targetUserId || !communityId) {
    return respond(
      {
        ok: false,
        error: "missing_fields",
        detail: "target_user_id and community_id are required",
      },
      400,
    );
  }

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(targetUserId) || !UUID_RE.test(communityId)) {
    return respond({ ok: false, error: "invalid_fields" }, 400);
  }

  if (targetUserId === callerId) {
    return respond({ ok: false, error: "cannot_reset_self" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Field operators are superadmins. Community admins retain the existing
  // community-scoped recovery capability. No other caller is authorized.
  const [{ data: isSuperadmin, error: superadminError }, { data: callerMembership, error: callerMemberError }] =
    await Promise.all([
      admin.rpc("is_superadmin", { p_user_id: callerId }),
      admin
        .from("community_members")
        .select("role, is_active")
        .eq("user_id", callerId)
        .eq("community_id", communityId)
        .maybeSingle(),
    ]);

  if (superadminError) {
    console.error(
      "[admin-generate-recovery-code] superadmin check failed:",
      superadminError.message,
    );
    return respond({ ok: false, error: "internal_error" }, 500);
  }

  if (callerMemberError) {
    console.error(
      "[admin-generate-recovery-code] caller membership query failed:",
      callerMemberError.message,
    );
    return respond({ ok: false, error: "internal_error" }, 500);
  }

  const isCommunityAdmin = Boolean(
    callerMembership?.is_active && callerMembership?.role === "ADMIN",
  );

  if (!isSuperadmin && !isCommunityAdmin) {
    return respond(
      {
        ok: false,
        error: "forbidden",
        detail: "Caller must be a Minerva superadmin or an active ADMIN of this community",
      },
      403,
    );
  }

  const { data: targetProfile, error: profileError } = await admin
    .from("profiles")
    .select(
      "user_id, community_id, auth_type, role, is_active, username, full_name, synthetic_email",
    )
    .eq("user_id", targetUserId)
    .eq("community_id", communityId)
    .maybeSingle();

  if (profileError) {
    console.error(
      "[admin-generate-recovery-code] profile query failed:",
      profileError.message,
    );
    return respond({ ok: false, error: "internal_error" }, 500);
  }

  if (!targetProfile) {
    return respond(
      {
        ok: false,
        error: "user_not_found",
        detail: "User not found in this community",
      },
      404,
    );
  }

  if (targetProfile.auth_type !== "username") {
    return respond(
      {
        ok: false,
        error: "email_user_not_supported",
        detail: "This user can use email recovery.",
      },
      400,
    );
  }

  if (String(targetProfile.role ?? "").toUpperCase() === "ADMIN") {
    return respond(
      {
        ok: false,
        error: "cannot_reset_admin",
        detail: "Admin accounts cannot be reset through this PIN flow",
      },
      403,
    );
  }

  const { error: expireError } = await admin
    .from("account_activation_codes")
    .update({ status: "expired", used_at: new Date().toISOString() })
    .eq("user_id", targetUserId)
    .eq("status", "pending");

  if (expireError) {
    console.error(
      "[admin-generate-recovery-code] expire old codes failed:",
      expireError.message,
    );
    return respond(
      { ok: false, error: "internal_error", step: "expire_old_codes" },
      500,
    );
  }

  const plainCode = generateSixDigitCode();
  const codeHash = await bcrypt.hash(plainCode, 10);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error: insertError } = await admin
    .from("account_activation_codes")
    .insert({
      user_id: targetUserId,
      community_id: communityId,
      code_hash: codeHash,
      visible_code: plainCode,
      activation_type: "password_recovery",
      status: "pending",
      expires_at: expiresAt,
      created_by: callerId,
      metadata: {
        purpose: "password_recovery",
        generated_by: isSuperadmin ? "minerva_field" : "community_admin",
        username: targetProfile.username ?? null,
        full_name: targetProfile.full_name ?? null,
      },
    });

  if (insertError) {
    console.error(
      "[admin-generate-recovery-code] insert failed:",
      insertError.message,
    );
    return respond(
      { ok: false, error: "internal_error", step: "insert_code" },
      500,
    );
  }

  admin
    .from("security_event_log")
    .insert({
      user_id: targetUserId,
      event_type: "RECOVERY_CODE_GENERATED",
      identifier: "admin-generate-recovery-code",
      success: true,
      metadata: {
        generated_by: callerId,
        generated_by_scope: isSuperadmin ? "superadmin" : "community_admin",
        community_id: communityId,
        username: targetProfile.username ?? null,
        expires_at: expiresAt,
      },
    })
    .then(({ error: logError }) => {
      if (logError) {
        console.warn(
          "[admin-generate-recovery-code] audit log warn:",
          logError.message,
        );
      }
    })
    .catch((error: unknown) => {
      console.warn(
        "[admin-generate-recovery-code] audit log threw:",
        String(error).slice(0, 80),
      );
    });

  return respond(
    {
      ok: true,
      activation_code: plainCode,
      expires_at: expiresAt,
      target_user_id: targetUserId,
      username: targetProfile.username ?? null,
      full_name: targetProfile.full_name ?? null,
      auth_type: "username",
    },
    200,
  );
});
