import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JsonObject = Record<string, unknown>;

type EntryLogContext = {
  id: string;
  community_id: string;
  vehicle_photo_path: string | null;
  vehicle_plate_text: string | null;
};

type UsageMetadata = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

const OCR_BUCKET = "entry-photos";
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Google AI standard paid-list pricing reviewed 2026-09-07.
// This is an estimate for operational attribution, not an invoice reconciliation.
// https://ai.google.dev/gemini-api/docs/pricing
const PRICING_VERSION = "google-ai-gemini-2.5-flash-standard-list-2026-09-07";
const INPUT_USD_PER_MILLION_TOKENS = 0.3;
const OUTPUT_USD_PER_MILLION_TOKENS = 2.5;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const PLATE_PROMPT = `You are a license plate OCR system for Honduras (Central America).

This image shows a vehicle. Find the license plate and read it.

The Honduras license plate is a small rectangular metal plate on the bumper:
- Blue stripe at top: "HONDURAS"
- White center with large BLACK alphanumeric characters
- Blue stripe at bottom: "CENTROAMERICA"
- May be in shadow, at an angle, or partially dirty

Honduras plate format: 7 characters, letters then digits
Examples: HAB8580 HCM5024 BAA0001 GHA1234 BEG2548

OUTPUT RULES:
1. Output ONLY the plate characters, uppercase, NO spaces
2. Example correct outputs: HAB8580 or BAA0001 or HCM5024
3. If truly cannot read: output NO_PLATE
4. Nothing else - no explanation, no punctuation`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function extractText(data: unknown): string {
  const payload = data as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    }>;
  };
  const parts = payload?.candidates?.[0]?.content?.parts ?? [];
  const visibleText = parts.filter((part) => part.text && !part.thought);
  if (visibleText.length > 0) {
    return visibleText[visibleText.length - 1].text?.trim() ?? "";
  }
  for (const part of parts) {
    if (part.text?.trim()) return part.text.trim();
  }
  return "";
}

function getUsageMetadata(data: unknown): UsageMetadata {
  if (!data || typeof data !== "object" || !("usageMetadata" in data)) return {};
  const metadata = (data as { usageMetadata?: UsageMetadata }).usageMetadata;
  return metadata ?? {};
}

function asNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

function deriveTokenUsage(metadata: UsageMetadata) {
  const inputTokens = asNonNegativeInteger(metadata.promptTokenCount);
  const candidateTokens = asNonNegativeInteger(metadata.candidatesTokenCount);
  const thoughtTokens = asNonNegativeInteger(metadata.thoughtsTokenCount);
  const totalTokens = asNonNegativeInteger(metadata.totalTokenCount);

  let outputTokens: number | null = null;
  if (candidateTokens !== null || thoughtTokens !== null) {
    outputTokens = (candidateTokens ?? 0) + (thoughtTokens ?? 0);
  } else if (totalTokens !== null && inputTokens !== null) {
    outputTokens = Math.max(0, totalTokens - inputTokens);
  }

  return { inputTokens, outputTokens, candidateTokens, thoughtTokens, totalTokens };
}

function estimateStandardListCost(inputTokens: number | null, outputTokens: number | null) {
  if (inputTokens === null || outputTokens === null) return null;
  const raw =
    (inputTokens / 1_000_000) * INPUT_USD_PER_MILLION_TOKENS +
    (outputTokens / 1_000_000) * OUTPUT_USD_PER_MILLION_TOKENS;
  return Number(raw.toFixed(8));
}

function providerRequestId(response: Response): string | null {
  return (
    response.headers.get("x-goog-request-id") ??
    response.headers.get("x-request-id") ??
    null
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[extract-plate-text] missing Supabase runtime configuration");
    return json({ ok: false, error: "OCR service unavailable" }, 500);
  }
  if (!GEMINI_API_KEY) {
    console.error("[extract-plate-text] GEMINI_API_KEY missing");
    return json({ ok: false, error: "OCR provider unavailable" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Not authenticated" }, 401);

  const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (bearerToken !== SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Internal service role required" }, 403);
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: { image_path?: string; bucket?: string; entry_log_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const entryLogId = body.entry_log_id?.trim() ?? "";
  const imagePath = body.image_path?.trim() ?? "";
  const requestedBucket = body.bucket?.trim() || OCR_BUCKET;

  if (!entryLogId) return json({ error: "entry_log_id required" }, 400);
  if (!imagePath) return json({ error: "image_path required" }, 400);
  if (requestedBucket !== OCR_BUCKET) return json({ error: "Unsupported OCR bucket" }, 400);

  const { data: entryLogData, error: entryLogError } = await serviceClient
    .from("entry_logs")
    .select("id, community_id, vehicle_photo_path, vehicle_plate_text")
    .eq("id", entryLogId)
    .maybeSingle();

  if (entryLogError || !entryLogData) {
    return json({ error: "Entry log not found" }, 404);
  }

  const entryLog = entryLogData as EntryLogContext;
  if (!entryLog.community_id) return json({ error: "Entry log community missing" }, 409);
  if (!entryLog.vehicle_photo_path || entryLog.vehicle_photo_path !== imagePath) {
    return json({ error: "OCR image does not match entry log" }, 400);
  }

  const requestId = crypto.randomUUID();
  const correlationId = entryLogId;

  async function recordProviderUsage(args: {
    status: "success" | "failed";
    durationMs: number;
    errorCode?: string | null;
    response?: Response | null;
    usageMetadata?: UsageMetadata;
    resultKind?: "plate" | "no_plate" | "unknown";
  }) {
    const usage = deriveTokenUsage(args.usageMetadata ?? {});
    const estimatedCost = estimateStandardListCost(usage.inputTokens, usage.outputTokens);
    const metadata: JsonObject = {
      pricing_basis: "standard_paid_list",
      result_kind: args.resultKind ?? "unknown",
    };
    if (usage.candidateTokens !== null) metadata.candidate_tokens = usage.candidateTokens;
    if (usage.thoughtTokens !== null) metadata.thought_tokens = usage.thoughtTokens;
    if (usage.totalTokens !== null) metadata.total_tokens = usage.totalTokens;

    const { error } = await serviceClient.rpc("record_entry_usage_v1", {
      p_actor_id: null,
      p_community_id: entryLog.community_id,
      p_correlation_id: correlationId,
      p_currency: "USD",
      p_duration_ms: args.durationMs,
      p_error_code: args.errorCode ?? null,
      p_error_fingerprint:
        args.status === "failed" ? `gemini:plate_ocr:${args.errorCode ?? "failed"}` : null,
      p_estimated_cost: estimatedCost,
      p_image_count: 1,
      p_input_tokens: usage.inputTokens,
      p_metadata: metadata,
      p_operation: "image_ocr",
      p_output_tokens: usage.outputTokens,
      p_pricing_version: PRICING_VERSION,
      p_provider: "google_gemini",
      p_provider_request_id: args.response ? providerRequestId(args.response) : null,
      p_quantity: 1,
      p_request_id: requestId,
      p_service_model: GEMINI_MODEL,
      p_status: args.status,
    });

    if (error) {
      console.warn("[extract-plate-text] usage ledger write failed", {
        code: error.code ?? null,
        message: (error.message ?? "RPC error").slice(0, 160),
      });
    }
  }

  async function markQueueFailure(errorCode: string) {
    const { data: queue } = await serviceClient
      .from("plate_ocr_queue")
      .select("id, attempts, max_attempts")
      .eq("entry_log_id", entryLogId)
      .maybeSingle();

    if (!queue) return;
    const exhausted = Number(queue.max_attempts ?? 0) > 0 &&
      Number(queue.attempts ?? 0) >= Number(queue.max_attempts ?? 0);
    const nextRetry = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const updatePayload: JsonObject = {
      status: exhausted ? "FAILED" : "PENDING",
      last_error: errorCode,
    };
    if (!exhausted) updatePayload.scheduled_at = nextRetry;

    await serviceClient
      .from("plate_ocr_queue")
      .update(updatePayload)
      .eq("id", queue.id);
  }

  async function emitPersistenceFailure() {
    try {
      await serviceClient.rpc("log_system_event", {
        p_actor_id: null,
        p_community_id: entryLog.community_id,
        p_correlation_id: correlationId,
        p_details: { status: "failed", error_code: "OCR_PERSIST_FAILED" },
        p_entity_id: entryLogId,
        p_entity_type: "entry_log",
        p_event_type: "IMAGE_OCR_FAILED",
        p_message: "OCR result persistence failed",
        p_module: "ocr",
        p_severity: "ERROR",
        p_source: "extract-plate-text",
        p_user_id: null,
      });
    } catch {
      // Observability must never make OCR persistence fail harder.
    }
  }

  const { data: fileData, error: downloadError } = await serviceClient.storage
    .from(OCR_BUCKET)
    .download(imagePath);

  if (downloadError || !fileData) {
    await markQueueFailure("OCR_IMAGE_DOWNLOAD_FAILED");
    return json({ ok: false, error: "OCR image download failed" }, 500);
  }

  const base64Image = arrayBufferToBase64(await fileData.arrayBuffer());
  const extension = imagePath.split(".").pop()?.toLowerCase() ?? "jpeg";
  const mimeType = ({
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  } as Record<string, string>)[extension] ?? "image/jpeg";

  const providerStartedAt = Date.now();
  let geminiResponse: Response;
  try {
    geminiResponse = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64Image } },
            { text: PLATE_PROMPT },
          ],
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 200 },
      }),
    });
  } catch {
    const durationMs = Date.now() - providerStartedAt;
    await recordProviderUsage({
      status: "failed",
      durationMs,
      errorCode: "GEMINI_NETWORK_ERROR",
      resultKind: "unknown",
    });
    await markQueueFailure("GEMINI_NETWORK_ERROR");
    console.error("[extract-plate-text] Gemini network failure");
    return json({ ok: false, error: "OCR provider request failed" }, 502);
  }

  const durationMs = Date.now() - providerStartedAt;
  let geminiData: unknown = null;
  try {
    geminiData = await geminiResponse.json();
  } catch {
    geminiData = null;
  }

  const usageMetadata = getUsageMetadata(geminiData);

  if (!geminiResponse.ok) {
    await recordProviderUsage({
      status: "failed",
      durationMs,
      errorCode: `GEMINI_HTTP_${geminiResponse.status}`,
      response: geminiResponse,
      usageMetadata,
      resultKind: "unknown",
    });
    await markQueueFailure(`GEMINI_HTTP_${geminiResponse.status}`);
    return json({ ok: false, error: "OCR provider returned an error" }, 502);
  }

  if (!geminiData) {
    await recordProviderUsage({
      status: "failed",
      durationMs,
      errorCode: "GEMINI_INVALID_RESPONSE",
      response: geminiResponse,
      usageMetadata,
      resultKind: "unknown",
    });
    await markQueueFailure("GEMINI_INVALID_RESPONSE");
    return json({ ok: false, error: "OCR provider response was invalid" }, 502);
  }

  const rawText = extractText(geminiData);
  let plateText: string | null = null;
  if (rawText && rawText !== "NO_PLATE") {
    const normalized = rawText.toUpperCase().replace(/[^A-Z0-9-]/g, "").trim();
    plateText = normalized.length >= 4 ? normalized : null;
  }

  await recordProviderUsage({
    status: "success",
    durationMs,
    response: geminiResponse,
    usageMetadata,
    resultKind: plateText ? "plate" : "no_plate",
  });

  const { error: persistenceError } = await serviceClient
    .from("entry_logs")
    .update({ vehicle_plate_text: plateText })
    .eq("id", entryLogId);

  if (persistenceError) {
    await markQueueFailure("OCR_PERSIST_FAILED");
    await emitPersistenceFailure();
    return json({ ok: false, error: "OCR result persistence failed" }, 500);
  }

  await serviceClient
    .from("plate_ocr_queue")
    .update({
      status: "DONE",
      completed_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("entry_log_id", entryLogId);

  return json({
    ok: true,
    plate_text: plateText,
    entry_log_id: entryLogId,
  });
});
