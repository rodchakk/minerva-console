import { NextResponse } from "next/server";
import { getEntryOperationalActivity } from "@/features/entry/operations/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? "15");
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : 15;
  const result = await getEntryOperationalActivity(limit);

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
