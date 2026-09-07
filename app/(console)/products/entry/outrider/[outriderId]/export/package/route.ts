import { NextResponse } from "next/server";
import { getOutriderZipExport } from "@/features/entry/outrider/export";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ outriderId: string }> },
) {
  const params = await context.params;
  const zip = await getOutriderZipExport(params.outriderId);

  if (!zip) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return new NextResponse(zip.bytes, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename="${zip.filename}"`,
      "Content-Type": "application/zip",
    },
  });
}
