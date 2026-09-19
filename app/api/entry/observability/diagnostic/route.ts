import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/features/auth/requireSuperadmin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function unauthorized(status: 401 | 403) {
  return NextResponse.json(
    { error: status === 401 ? "Authentication required" : "Superadmin access required" },
    { status },
  );
}

function parseTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") return unauthorized(401);
  if (auth.status !== "authorized" || !auth.isSuperadmin) return unauthorized(403);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid diagnostic request" }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const startsAt = parseTimestamp(record.startsAt);
  const endsAt = parseTimestamp(record.endsAt);

  if (!startsAt || !endsAt || endsAt <= startsAt) {
    return NextResponse.json({ error: "Invalid diagnostic time range" }, { status: 400 });
  }

  const maxWindowMs = 31 * 24 * 60 * 60 * 1000;
  if (endsAt.getTime() - startsAt.getTime() > maxWindowMs) {
    return NextResponse.json({ error: "Diagnostic range cannot exceed 31 days" }, { status: 400 });
  }

  if (endsAt.getTime() > Date.now() + 5 * 60 * 1000) {
    return NextResponse.json({ error: "Diagnostic end time cannot be in the future" }, { status: 400 });
  }

  const communityId =
    typeof record.communityId === "string" && record.communityId.trim()
      ? record.communityId.trim()
      : null;
  const save = record.save === true;
  const notes =
    typeof record.notes === "string" && record.notes.trim()
      ? record.notes.trim().slice(0, 1000)
      : null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sa_generate_entry_diagnostic_bundle_v1", {
    p_community_id: communityId,
    p_ends_at: endsAt.toISOString(),
    p_notes: notes,
    p_save: save,
    p_starts_at: startsAt.toISOString(),
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not generate ENTRY diagnostic bundle" },
      { status: 500 },
    );
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") return unauthorized(401);
  if (auth.status !== "authorized" || !auth.isSuperadmin) return unauthorized(403);

  const snapshotId = request.nextUrl.searchParams.get("snapshot");
  if (!snapshotId) {
    return NextResponse.json({ error: "snapshot is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sa_get_entry_diagnostic_snapshot_v1", {
    p_snapshot_id: snapshotId,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Diagnostic snapshot not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
