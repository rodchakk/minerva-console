
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";

type ReceiptRow = {
  id: string;
  queue_id: string;
  community_id: string;
  ticket_id: string;
  token_hash: string;
  status: string;
  accepted_at: string;
  checked_at: string | null;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function logFailure(
  client: ReturnType<typeof createClient>,
  row: ReceiptRow,
  code: string,
): Promise<void> {
  try {
    await client.from("system_event_log").insert({
      severity: "ERROR",
      module: "community_message_push",
      event_type: "PUSH_RECEIPT_FAILED",
      message: "Expo push receipt reported a delivery failure",
      details: {
        status: "failed",
        error_code: code.slice(0, 96),
        error_fingerprint: `expo_push_receipt:${code.slice(0, 96).toLowerCase()}`,
      },
      community_id: row.community_id,
      entity_type: "community_message_push_queue",
      entity_id: row.queue_id,
      source: "entry-push-receipts",
    });
  } catch {
    // Best effort only.
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expectedSecret = requiredEnv("INTERNAL_QUEUE_SECRET");
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const client = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const body = await req.json().catch(() => ({}));
  const requested = Number(body?.limit ?? 300);
  const limit = Number.isFinite(requested)
    ? Math.max(1, Math.min(Math.trunc(requested), 300))
    : 300;

  const cutoff = new Date(Date.now() - 30_000).toISOString();
  const { data, error } = await client
    .from("entry_mobile_push_receipts")
    .select("id,queue_id,community_id,ticket_id,token_hash,status,accepted_at,checked_at")
    .in("status", ["accepted", "unknown"])
    .lte("accepted_at", cutoff)
    .order("accepted_at", { ascending: true })
    .limit(limit);

  if (error) {
    return json({ ok: false, error: "receipt_query_failed" }, 500);
  }

  const rows = (data ?? []) as ReceiptRow[];
  if (!rows.length) {
    return json({ ok: true, checked: 0, delivered: 0, failed: 0, pending: 0 });
  }

  let delivered = 0;
  let failed = 0;
  let pending = 0;

  for (let offset = 0; offset < rows.length; offset += 300) {
    const chunk = rows.slice(offset, offset + 300);
    const ids = chunk.map((row) => row.ticket_id);

    let providerData: Record<string, unknown> = {};
    try {
      const response = await fetch(EXPO_RECEIPTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) {
        pending += chunk.length;
        await client
          .from("entry_mobile_push_receipts")
          .update({ status: "unknown", checked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .in("id", chunk.map((row) => row.id));
        continue;
      }

      const payload = await response.json().catch(() => null);
      providerData = isRecord(payload) && isRecord(payload.data)
        ? payload.data as Record<string, unknown>
        : {};
    } catch {
      pending += chunk.length;
      await client
        .from("entry_mobile_push_receipts")
        .update({ status: "unknown", checked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .in("id", chunk.map((row) => row.id));
      continue;
    }

    for (const row of chunk) {
      const receipt = providerData[row.ticket_id];
      const nowIso = new Date().toISOString();

      if (!isRecord(receipt)) {
        const expired = Date.now() - new Date(row.accepted_at).getTime() > 24 * 60 * 60 * 1000;
        if (expired) {
          await client.from("entry_mobile_push_receipts").update({
            status: "failed",
            provider_code: "ReceiptUnavailable",
            provider_message: "Expo did not return a receipt within the observation window",
            checked_at: nowIso,
            completed_at: nowIso,
            updated_at: nowIso,
          }).eq("id", row.id);
          await logFailure(client, row, "ReceiptUnavailable");
          failed += 1;
        } else {
          await client.from("entry_mobile_push_receipts").update({
            status: "unknown",
            checked_at: nowIso,
            updated_at: nowIso,
          }).eq("id", row.id);
          pending += 1;
        }
        continue;
      }

      if (receipt.status === "ok") {
        await client.from("entry_mobile_push_receipts").update({
          status: "delivered",
          provider_code: null,
          provider_message: null,
          checked_at: nowIso,
          completed_at: nowIso,
          updated_at: nowIso,
        }).eq("id", row.id);
        delivered += 1;
        continue;
      }

      const details = isRecord(receipt.details) ? receipt.details : {};
      const code = typeof details.error === "string" ? details.error.slice(0, 96) : "ExpoReceiptError";
      const message = typeof receipt.message === "string" ? receipt.message.slice(0, 240) : "Expo push receipt reported an error";

      await client.from("entry_mobile_push_receipts").update({
        status: "failed",
        provider_code: code,
        provider_message: message,
        checked_at: nowIso,
        completed_at: nowIso,
        updated_at: nowIso,
      }).eq("id", row.id);

      if (code === "DeviceNotRegistered") {
        await client.from("user_push_tokens").update({
          is_active: false,
          updated_at: nowIso,
        }).eq("community_id", row.community_id)
          .eq("expo_push_token_hash", row.token_hash)
          .eq("is_active", true);
      }

      await logFailure(client, row, code);
      failed += 1;
    }
  }

  return json({
    ok: true,
    checked: rows.length,
    delivered,
    failed,
    pending,
  });
});
