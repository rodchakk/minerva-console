import { NextResponse } from "next/server";
import {
  getEntryPushApiUser,
  getEntryPushPublicKey,
} from "@/features/entry/push/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getEntryPushApiUser();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Unauthenticated" : "Forbidden" },
      { status: auth.status, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const publicKey = getEntryPushPublicKey();
  if (!publicKey) {
    return NextResponse.json(
      { error: "ENTRY Web Push is not configured" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  return NextResponse.json(
    { publicKey },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
