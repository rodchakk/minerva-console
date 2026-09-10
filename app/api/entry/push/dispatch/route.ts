import { NextResponse } from "next/server";
import {
  dispatchPendingEntryPushes,
  dispatchSecretMatches,
} from "@/features/entry/push/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function POST(request: Request) {
  if (!process.env.ENTRY_WEB_PUSH_DISPATCH_SECRET?.trim()) {
    return json({ error: "Dispatcher is not configured" }, 503);
  }

  if (!dispatchSecretMatches(request)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const body = (await request.json().catch(() => ({}))) as { limit?: unknown };
  const requestedLimit = Number(body.limit ?? 50);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(Math.trunc(requestedLimit), 100))
    : 50;

  try {
    const summary = await dispatchPendingEntryPushes(limit);
    return json(summary);
  } catch (error) {
    console.error("[entry-web-push] dispatch cycle failed", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return json({ ok: false, error: "ENTRY Web Push dispatch failed" }, 503);
  }
}
