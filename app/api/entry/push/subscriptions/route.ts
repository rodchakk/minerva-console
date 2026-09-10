import { NextResponse } from "next/server";
import {
  deactivateEntryPushSubscription,
  getEntryPushApiUser,
  isValidPushEndpoint,
  isValidPushKey,
  saveEntryPushSubscription,
  type EntryPushSurface,
} from "@/features/entry/push/server";

export const dynamic = "force-dynamic";

function noStore(status = 200) {
  return {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  };
}

function unauthorized(status: 401 | 403) {
  return NextResponse.json(
    { error: status === 401 ? "Unauthenticated" : "Forbidden" },
    noStore(status),
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function surfaceFrom(value: unknown): EntryPushSurface {
  return value === "field" ? "field" : "console";
}

export async function POST(request: Request) {
  const auth = await getEntryPushApiUser();
  if (!auth.ok) return unauthorized(auth.status);

  const body = asRecord(await request.json().catch(() => ({})));
  const subscription = asRecord(body.subscription);
  const keys = asRecord(subscription.keys);
  const endpoint = subscription.endpoint;
  const p256dh = keys.p256dh;
  const authSecret = keys.auth;

  if (
    !isValidPushEndpoint(endpoint) ||
    !isValidPushKey(p256dh, 20) ||
    !isValidPushKey(authSecret, 8)
  ) {
    return NextResponse.json({ error: "Invalid Web Push subscription" }, noStore(400));
  }

  try {
    const subscriptionId = await saveEntryPushSubscription({
      userId: auth.user.id,
      endpoint,
      p256dh,
      authSecret,
      surface: surfaceFrom(body.surface),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, subscriptionId }, noStore(200));
  } catch (error) {
    console.error("[entry-web-push] subscription save failed", {
      userId: auth.user.id,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "Could not enable ENTRY alerts" },
      noStore(503),
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await getEntryPushApiUser();
  if (!auth.ok) return unauthorized(auth.status);

  const body = asRecord(await request.json().catch(() => ({})));
  const endpoint = body.endpoint;

  if (!isValidPushEndpoint(endpoint)) {
    return NextResponse.json({ error: "Invalid Web Push endpoint" }, noStore(400));
  }

  try {
    const deactivated = await deactivateEntryPushSubscription({
      userId: auth.user.id,
      endpoint,
    });
    return NextResponse.json({ ok: true, deactivated }, noStore(200));
  } catch (error) {
    console.error("[entry-web-push] subscription deactivation failed", {
      userId: auth.user.id,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "Could not disable ENTRY alerts" },
      noStore(503),
    );
  }
}
