import "server-only";

import { timingSafeEqual } from "node:crypto";
import webpush, { type WebPushError } from "web-push";
import { getAuthContext } from "@/features/auth/requireSuperadmin";
import { createAdminClient } from "@/lib/supabase/admin";

export type EntryPushSurface = "console" | "field";

type ClaimedDelivery = {
  delivery_id?: unknown;
  event_id?: unknown;
  subscription_id?: unknown;
  endpoint?: unknown;
  p256dh?: unknown;
  auth_secret?: unknown;
  ticket_id?: unknown;
  ticket_number?: unknown;
  event_type?: unknown;
  surface?: unknown;
  attempts?: unknown;
};

type NormalizedDelivery = {
  deliveryId: string;
  eventId: string;
  subscriptionId: string;
  endpoint: string;
  p256dh: string;
  authSecret: string;
  ticketId: string;
  ticketNumber: string;
  eventType: "ticket_created" | "incoming_message";
  surface: EntryPushSurface;
  attempts: number;
};

export type EntryPushDispatchSummary = {
  ok: boolean;
  claimed: number;
  sent: number;
  failed: number;
  retried: number;
  pruned: number;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asInteger(value: unknown): number {
  const number = Number(value);
  return Number.isInteger(number) ? number : 0;
}

function normalizeDelivery(value: ClaimedDelivery): NormalizedDelivery | null {
  const deliveryId = asString(value.delivery_id);
  const eventId = asString(value.event_id);
  const subscriptionId = asString(value.subscription_id);
  const endpoint = asString(value.endpoint);
  const p256dh = asString(value.p256dh);
  const authSecret = asString(value.auth_secret);
  const ticketId = asString(value.ticket_id);
  const ticketNumber = asString(value.ticket_number);
  const rawEventType = asString(value.event_type);

  if (
    !deliveryId ||
    !eventId ||
    !subscriptionId ||
    !endpoint ||
    !p256dh ||
    !authSecret ||
    !ticketId ||
    !ticketNumber ||
    (rawEventType !== "ticket_created" && rawEventType !== "incoming_message")
  ) {
    return null;
  }

  return {
    deliveryId,
    eventId,
    subscriptionId,
    endpoint,
    p256dh,
    authSecret,
    ticketId,
    ticketNumber: ticketNumber.slice(0, 64),
    eventType: rawEventType,
    surface: value.surface === "field" ? "field" : "console",
    attempts: Math.max(0, Math.min(asInteger(value.attempts), 8)),
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getVapidConfig() {
  const subject = requiredEnv("ENTRY_WEB_PUSH_VAPID_SUBJECT");
  const publicKey = requiredEnv("ENTRY_WEB_PUSH_VAPID_PUBLIC_KEY");
  const privateKey = requiredEnv("ENTRY_WEB_PUSH_VAPID_PRIVATE_KEY");

  if (!/^mailto:|^https:\/\//.test(subject)) {
    throw new Error("ENTRY_WEB_PUSH_VAPID_SUBJECT must be a mailto: or https:// URI.");
  }

  return { subject, publicKey, privateKey };
}

export function getEntryPushPublicKey(): string | null {
  return process.env.ENTRY_WEB_PUSH_VAPID_PUBLIC_KEY?.trim() || null;
}

export async function getEntryPushApiUser() {
  const context = await getAuthContext();

  if (context.status === "unauthenticated") {
    return { ok: false as const, status: 401 as const, user: null };
  }

  if (context.status !== "authorized" || !context.isSuperadmin || !context.user) {
    return { ok: false as const, status: 403 as const, user: null };
  }

  return { ok: true as const, status: 200 as const, user: context.user };
}

export function isValidPushEndpoint(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 20 &&
    value.length <= 4096 &&
    /^https:\/\/[^\s]+$/.test(value)
  );
}

export function isValidPushKey(value: unknown, minimumLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length >= minimumLength &&
    value.length <= 512 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

export async function saveEntryPushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  authSecret: string;
  surface: EntryPushSurface;
  userAgent: string | null;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("upsert_entry_web_push_subscription_v1", {
    p_user_id: input.userId,
    p_endpoint: input.endpoint,
    p_p256dh: input.p256dh,
    p_auth_secret: input.authSecret,
    p_surface: input.surface,
    p_user_agent: input.userAgent,
  });

  if (error) {
    throw new Error(`Failed saving ENTRY Web Push subscription (${error.code}).`);
  }

  return typeof data === "string" ? data : null;
}

export async function deactivateEntryPushSubscription(input: {
  userId: string;
  endpoint: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("deactivate_entry_web_push_subscription_v1", {
    p_user_id: input.userId,
    p_endpoint: input.endpoint,
  });

  if (error) {
    throw new Error(`Failed deactivating ENTRY Web Push subscription (${error.code}).`);
  }

  return Number(data ?? 0);
}

export async function bestEffortDeactivateEntryPushSubscription(input: {
  userId: string;
  endpoint: string;
  timeoutMs?: number;
}) {
  if (!isValidPushEndpoint(input.endpoint)) return;

  try {
    await Promise.race([
      deactivateEntryPushSubscription(input),
      new Promise<void>((resolve) => {
        setTimeout(resolve, input.timeoutMs ?? 650);
      }),
    ]);
  } catch (error) {
    console.warn("[entry-web-push] best-effort sign-out cleanup failed", {
      userId: input.userId,
      errorName: error instanceof Error ? error.name : "unknown",
    });
  }
}

export function dispatchSecretMatches(request: Request): boolean {
  const expected = process.env.ENTRY_WEB_PUSH_DISPATCH_SECRET?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  const received = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!expected || !received) return false;

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

function buildTicketUrl(surface: EntryPushSurface, ticketId: string) {
  return surface === "field"
    ? `/field/entry/tickets/${ticketId}`
    : `/products/entry/tickets/${ticketId}`;
}

function buildPayload(delivery: NormalizedDelivery) {
  return JSON.stringify({
    title: `ENTRY · ${delivery.ticketNumber}`,
    body:
      delivery.eventType === "ticket_created"
        ? "New support ticket received."
        : "New reply received on a support ticket.",
    url: buildTicketUrl(delivery.surface, delivery.ticketId),
    tag: `entry-ticket-${delivery.ticketId}`,
  });
}

function readStatusCode(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const status = (error as WebPushError).statusCode;
  return Number.isInteger(status) ? Number(status) : null;
}

function retryDelaySeconds(attempts: number) {
  const exponent = Math.max(0, Math.min(attempts - 1, 6));
  return Math.min(60 * 2 ** exponent, 3600);
}

function deliveryOutcome(error: unknown, attempts: number) {
  const status = readStatusCode(error);

  if (status === 404 || status === 410) {
    return {
      outcome: "pruned" as const,
      status,
      retryAfterSeconds: 60,
      error: "Push subscription is no longer valid",
    };
  }

  if (status === 429 || (status !== null && status >= 500) || status === null) {
    return {
      outcome: attempts < 8 ? ("retry" as const) : ("failed" as const),
      status,
      retryAfterSeconds: retryDelaySeconds(attempts),
      error: status ? `Transient Web Push provider failure (${status})` : "Transient Web Push transport failure",
    };
  }

  return {
    outcome: "failed" as const,
    status,
    retryAfterSeconds: 60,
    error: status ? `Permanent Web Push provider failure (${status})` : "Permanent Web Push delivery failure",
  };
}

async function recordDispatchEvent(
  severity: "INFO" | "WARN" | "ERROR",
  eventType: string,
  message: string,
  details: Record<string, unknown>,
) {
  try {
    const admin = createAdminClient();
    await admin.from("system_event_log").insert({
      severity,
      module: "entry_web_push",
      event_type: eventType,
      message,
      details,
      source: "minerva-console",
    });
  } catch {
    // Observability is best-effort and must never stop notification delivery.
  }
}

async function completeDelivery(input: {
  deliveryId: string;
  outcome: "sent" | "retry" | "failed" | "pruned";
  providerStatus: number | null;
  error: string | null;
  retryAfterSeconds: number;
}) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("complete_entry_web_push_delivery_v1", {
    p_delivery_id: input.deliveryId,
    p_outcome: input.outcome,
    p_provider_status: input.providerStatus,
    p_error: input.error,
    p_retry_after_seconds: input.retryAfterSeconds,
  });

  if (error) {
    console.error("[entry-web-push] failed to complete delivery state", {
      deliveryId: input.deliveryId,
      code: error.code,
    });
  }
}

export async function dispatchPendingEntryPushes(limit = 50): Promise<EntryPushDispatchSummary> {
  const vapid = getVapidConfig();
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const admin = createAdminClient();
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit) || 50, 100));
  const { data, error } = await admin.rpc("claim_entry_web_push_deliveries_v1", {
    p_limit: safeLimit,
  });

  if (error) {
    await recordDispatchEvent(
      "ERROR",
      "ENTRY_WEB_PUSH_CLAIM_FAILED",
      "ENTRY Web Push dispatcher could not claim work",
      { status: "failed", code: error.code },
    );
    throw new Error(`Failed claiming ENTRY Web Push deliveries (${error.code}).`);
  }

  const deliveries = (Array.isArray(data) ? data : [])
    .map((row) => normalizeDelivery(row as ClaimedDelivery))
    .filter((row): row is NormalizedDelivery => row !== null);

  const summary: EntryPushDispatchSummary = {
    ok: true,
    claimed: deliveries.length,
    sent: 0,
    failed: 0,
    retried: 0,
    pruned: 0,
  };

  for (const delivery of deliveries) {
    try {
      const response = await webpush.sendNotification(
        {
          endpoint: delivery.endpoint,
          keys: {
            p256dh: delivery.p256dh,
            auth: delivery.authSecret,
          },
        },
        buildPayload(delivery),
        {
          TTL: 300,
          urgency: "high",
          topic: `entry-${delivery.ticketId}`.slice(0, 32),
        },
      );

      await completeDelivery({
        deliveryId: delivery.deliveryId,
        outcome: "sent",
        providerStatus: response.statusCode,
        error: null,
        retryAfterSeconds: 60,
      });
      summary.sent += 1;
    } catch (error) {
      const result = deliveryOutcome(error, delivery.attempts);
      await completeDelivery({
        deliveryId: delivery.deliveryId,
        outcome: result.outcome,
        providerStatus: result.status,
        error: result.error,
        retryAfterSeconds: result.retryAfterSeconds,
      });

      if (result.outcome === "pruned") summary.pruned += 1;
      else if (result.outcome === "retry") summary.retried += 1;
      else summary.failed += 1;
    }
  }

  await recordDispatchEvent(
    summary.failed > 0 ? "WARN" : "INFO",
    "ENTRY_WEB_PUSH_DISPATCH_COMPLETED",
    "ENTRY Web Push dispatcher completed a cycle",
    {
      status: summary.failed > 0 ? "partial" : "success",
      claimed: summary.claimed,
      sent: summary.sent,
      failed: summary.failed,
      retried: summary.retried,
      pruned: summary.pruned,
    },
  );

  return summary;
}
