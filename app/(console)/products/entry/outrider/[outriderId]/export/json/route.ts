import { NextResponse } from "next/server";
import { getOutriderJsonExport } from "@/features/entry/outrider/export";
import { sanitizeOutriderFilename } from "@/features/entry/outrider/model";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ outriderId: string }> },
) {
  const params = await context.params;
  const summary = await getOutriderJsonExport(params.outriderId);

  if (!summary) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(summary, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename="${sanitizeOutriderFilename(
        summary.community.name,
      )}-outrider-summary.json"`,
    },
  });
}
