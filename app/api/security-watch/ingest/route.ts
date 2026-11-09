import { NextResponse } from "next/server";
import { authenticateGitHubActions } from "@/scripts/security-watch-oidc.mjs";
import { parseScan } from "@/features/security-watch/model";
import { recordSecurityWatchScan } from "@/features/security-watch/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This endpoint is ONLY for the scheduled public-advisory scanner.
// It does not accept URLs to fetch, code uploads, repository tokens, SQL or shell commands.
export async function POST(request: Request) {
  let identity: { runId: string } | null = null;
  try {
    identity = await authenticateGitHubActions(request.headers.get("authorization"));
  } catch {
    // A JWKS outage never turns the endpoint into an unauthenticated write surface.
    return NextResponse.json({ error: "Identity provider unavailable" }, { status: 503 });
  }
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") {
    return NextResponse.json({ error: "JSON required" }, { status: 415 });
  }
  if (Number(request.headers.get("content-length") || 0) > 260_000) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  try {
    const body = await request.text();
    if (body.length > 260_000) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    const scan = parseScan(JSON.parse(body));
    if (!scan || scan.runId !== identity.runId) return NextResponse.json({ error: "Invalid scan report" }, { status: 400 });
    const { duplicate, state } = await recordSecurityWatchScan(scan);
    const notificationFailed = state.notification === "failed" || state.notification === "not_configured";
    return NextResponse.json({
      ok: !notificationFailed,
      duplicate,
      status: state.status,
      notifications: state.notification,
      findings: state.findings.length
    }, { status: notificationFailed ? 503 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[security-watch] Failed to record scan", {
      name: error instanceof Error ? error.name : "Unknown",
    });
    return NextResponse.json({ error: "Unable to store scan" }, { status: 503 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
