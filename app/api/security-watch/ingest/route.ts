import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { parseScan } from "@/features/security-watch/model";
import { recordSecurityWatchScan } from "@/features/security-watch/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const expected = process.env.SECURITY_WATCH_INGEST_TOKEN;
  const header = request.headers.get("authorization") || "";
  const actual = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!expected || expected.length < 32 || !actual) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

// This endpoint is ONLY for the scheduled public-advisory scanner.
// It does not accept URLs to fetch, code uploads, repository tokens, SQL or shell commands.
export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    if (!scan) return NextResponse.json({ error: "Invalid scan report" }, { status: 400 });
    const { duplicate, state } = await recordSecurityWatchScan(scan);
    return NextResponse.json({
      ok: true,
      duplicate,
      status: state.status,
      notifications: state.notification,
      findings: state.findings.length
    }, { headers: { "Cache-Control": "no-store" } });
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
