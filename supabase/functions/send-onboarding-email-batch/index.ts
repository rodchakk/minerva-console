// supabase/functions/send-onboarding-email-batch/index.ts
//
// Worker that processes pending onboarding_campaign_messages in small
// batches. Designed to be invoked periodically (e.g. once per minute via
// pg_cron + pg_net, or via an external scheduler).
//
// Behaviour
// ─────────
//   * Reads all onboarding_campaigns with status='running'.
//   * For each campaign:
//       1. Claims up to `send_rate_per_minute` (or ?limit=) pending
//          messages, atomically transitioning them to 'processing'.
//       2. For each claimed message:
//            - Generates a fresh PIN via generate_resident_activation_pins_v1.
//            - Sends the activation email via Resend (or stubs out the call
//              when running in dry-run mode).
//            - Marks the message as 'sent' or 'failed' and updates the
//              resident_activation_queue row to 'invited'.
//       3. Calls refresh_onboarding_campaign_counters_v1 to recompute
//          counters and auto-complete the campaign if nothing remains.
//
// Safety
// ──────
//   * The PIN is generated just-in-time per send and is NEVER written to
//     the messages table. Only the provider message id and a non-sensitive
//     status are persisted.
//   * dry-run mode is the DEFAULT. The function only calls the real email
//     provider when ONBOARDING_CAMPAIGN_DRY_RUN=false AND the campaign
//     itself has dry_run=false. When either is true, the message is
//     marked as sent with provider='dry_run' — no email leaves the box.
//   * Concurrency is bounded by:
//       - select(limit) + update(in ids).eq('status','pending')
//         which is a best-effort claim (PostgREST does not give us
//         SELECT … FOR UPDATE SKIP LOCKED). For our scale this is fine.
//
// Required env (Edge Function secrets)
// ────────────────────────────────────
//   SUPABASE_URL                   - auto-injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY      - auto-injected by Supabase
//   RESEND_API_KEY                 - required for real sends
//   ONBOARDING_CAMPAIGN_DRY_RUN    - "true" (default) blocks real sends
//   ACTIVATION_BASE_URL            - e.g. https://console.minervatechs.com
//   ONBOARDING_FROM_ADDRESS        - default: ENTRY <no-reply@minervatechs.com>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";
import { Resend } from "https://esm.sh/resend@4.0.0";

type Json = Record<string, unknown>;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const GLOBAL_DRY_RUN =
  (Deno.env.get("ONBOARDING_CAMPAIGN_DRY_RUN") ?? "true").toLowerCase() !== "false";
const ACTIVATION_BASE_URL = (Deno.env.get("ACTIVATION_BASE_URL") ?? "").replace(/\/$/, "");
const FROM_ADDRESS =
  Deno.env.get("ONBOARDING_FROM_ADDRESS") ?? "ENTRY <no-reply@minervatechs.com>";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("send-onboarding-email-batch: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

function buildEmailHtml(args: {
  residentName: string | null;
  unitLabel: string | null;
  pin: string;
  activationLink: string;
}): string {
  const name = escapeHtml(args.residentName ?? "Resident");
  const unit = args.unitLabel ? `(Unit: ${escapeHtml(args.unitLabel)}) ` : "";
  const pin = escapeHtml(args.pin);
  const link = escapeHtml(args.activationLink);

  return `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
    <h2>Welcome to ENTRY</h2>
    <p>Hello ${name},</p>
    <p>Your ENTRY account ${unit}is ready to be activated.</p>
    <div style="margin:30px 0;padding:20px;background:#f4f4f5;border-radius:12px;text-align:center;">
      <p style="margin:0;font-size:14px;color:#666;">Activation PIN</p>
      <p style="margin:10px 0 0;font-size:32px;font-weight:bold;font-family:monospace;letter-spacing:4px;color:#6d28d9;">${pin}</p>
    </div>
    <p style="margin-bottom:24px;">Open the ENTRY app on your phone and tap the button below to finish activation:</p>
    <a href="${link}" style="display:inline-block;background:#6d28d9;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;">Activate Account</a>
    <p style="margin-top:30px;font-size:14px;color:#666;">If the button does not work, open the ENTRY app and enter the PIN manually.<br/><em>This PIN expires in 7 days.</em></p>
  </div>`;
}

type ClaimedMessage = {
  id: string;
  campaign_id: string;
  community_id: string;
  activation_queue_id: string;
  recipient_email: string | null;
  resident_name: string | null;
  unit_label: string | null;
  attempt_count: number;
  dry_run: boolean;
};

async function claimPendingMessages(args: {
  campaignId: string;
  limit: number;
}): Promise<ClaimedMessage[]> {
  const { campaignId, limit } = args;
  const nowIso = new Date().toISOString();

  const { data: pendingIds, error: pickErr } = await supabase
    .from("onboarding_campaign_messages")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (pickErr) {
    console.error("claim: pick error", pickErr);
    return [];
  }

  const ids = (pendingIds ?? []).map((r) => r.id);
  if (ids.length === 0) return [];

  const { data: claimed, error: updErr } = await supabase
    .from("onboarding_campaign_messages")
    .update({ status: "processing", last_attempt_at: nowIso })
    .in("id", ids)
    .eq("status", "pending")
    .select(
      "id, campaign_id, community_id, activation_queue_id, recipient_email, resident_name, unit_label, attempt_count, dry_run",
    );

  if (updErr) {
    console.error("claim: update error", updErr);
    return [];
  }

  return (claimed ?? []) as ClaimedMessage[];
}

async function processMessage(
  msg: ClaimedMessage,
  dryRunEffective: boolean,
  resend: Resend | null,
): Promise<{ ok: boolean; error?: string }> {
  const nowIso = new Date().toISOString();
  const nextAttempt = (msg.attempt_count ?? 0) + 1;

  try {
    if (!msg.recipient_email) {
      throw new Error("missing_recipient_email");
    }

    // Generate a fresh PIN just-in-time via the worker-only RPC.
    // worker_generate_resident_activation_pin_v1 is service_role-gated
    // (both via auth.role() check and via GRANT) so it does not depend on
    // a user JWT — which the generic generate_resident_activation_pins_v1
    // does (it calls is_superadmin() → auth.uid()).
    const { data: pinData, error: pinErr } = await supabase.rpc(
      "worker_generate_resident_activation_pin_v1",
      {
        p_community_id: msg.community_id,
        p_queue_id: msg.activation_queue_id,
      },
    );

    if (pinErr) throw new Error(`pin_generation_failed: ${pinErr.message}`);
    const pinRow = pinData as { pin?: string | null; status?: string } | null;
    if (!pinRow || pinRow.status !== "pin_generated" || !pinRow.pin) {
      throw new Error("pin_not_generated");
    }
    const generatedPin = pinRow.pin;

    const activationLink = ACTIVATION_BASE_URL
      ? `${ACTIVATION_BASE_URL}/activate?pin=${encodeURIComponent(generatedPin)}`
      : `entry://activate?pin=${encodeURIComponent(generatedPin)}`;

    let provider = "resend";
    let providerMessageId: string | null = null;

    if (dryRunEffective || !resend) {
      provider = "dry_run";
      providerMessageId = `dry_run_${msg.id}`;
    } else {
      const { data: emailData, error: emailErr } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: [msg.recipient_email],
        subject: "Your ENTRY activation code",
        html: buildEmailHtml({
          residentName: msg.resident_name,
          unitLabel: msg.unit_label,
          pin: generatedPin,
          activationLink,
        }),
      });
      if (emailErr) throw new Error(emailErr.message ?? "resend_send_failed");
      providerMessageId = (emailData as { id?: string } | null)?.id ?? null;
    }

    await supabase
      .from("onboarding_campaign_messages")
      .update({
        status: "sent",
        sent_at: nowIso,
        provider,
        provider_message_id: providerMessageId,
        attempt_count: nextAttempt,
        last_error: null,
      })
      .eq("id", msg.id);

    // Promote the queue row to 'invited' (unless already activated).
    await supabase
      .from("resident_activation_queue")
      .update({
        status: "invited",
        invite_sent_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", msg.activation_queue_id)
      .neq("status", "activated");

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("onboarding_campaign_messages")
      .update({
        status: "failed",
        failed_at: nowIso,
        last_error: message.slice(0, 500),
        attempt_count: nextAttempt,
      })
      .eq("id", msg.id);
    return { ok: false, error: message };
  }
}

Deno.serve(async (req) => {
  // Allow optional ?campaign_id=… (focus a single campaign) and ?limit=…
  const url = new URL(req.url);
  const campaignFilter = url.searchParams.get("campaign_id");
  const limitParam = Number(url.searchParams.get("limit") ?? "0");

  // Fetch running campaigns
  const { data: campaigns, error: cErr } = await supabase
    .from("onboarding_campaigns")
    .select("id, community_id, send_rate_per_minute, dry_run, status")
    .eq("status", "running")
    .order("started_at", { ascending: true });

  if (cErr) {
    return new Response(JSON.stringify({ ok: false, error: cErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const targetCampaigns = campaignFilter
    ? (campaigns ?? []).filter((c) => c.id === campaignFilter)
    : campaigns ?? [];

  const summary: Json[] = [];

  for (const campaign of targetCampaigns) {
    const batchSize = Math.max(
      1,
      Math.min(120, limitParam || campaign.send_rate_per_minute || 10),
    );
    const dryRunEffective = GLOBAL_DRY_RUN || Boolean(campaign.dry_run);
    const resend = !dryRunEffective && RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

    if (!dryRunEffective && !RESEND_API_KEY) {
      console.warn(
        `campaign ${campaign.id}: dry_run requested off but RESEND_API_KEY missing — forcing dry_run`,
      );
    }

    const claimed = await claimPendingMessages({
      campaignId: campaign.id,
      limit: batchSize,
    });

    let sent = 0;
    let failed = 0;

    for (const msg of claimed) {
      const result = await processMessage(msg, dryRunEffective || !resend, resend);
      if (result.ok) sent++;
      else failed++;
    }

    // Refresh counters + auto-complete
    const { error: refreshErr } = await supabase.rpc(
      "refresh_onboarding_campaign_counters_v1",
      { p_campaign_id: campaign.id },
    );
    if (refreshErr) {
      console.error(`refresh counters failed for ${campaign.id}`, refreshErr);
    }

    summary.push({
      campaign_id: campaign.id,
      claimed: claimed.length,
      sent,
      failed,
      dry_run: dryRunEffective,
    });
  }

  return new Response(
    JSON.stringify({ ok: true, processed_campaigns: summary.length, campaigns: summary }),
    { headers: { "Content-Type": "application/json" } },
  );
});
