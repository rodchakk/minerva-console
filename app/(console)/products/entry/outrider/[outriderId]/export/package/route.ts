import { NextResponse } from "next/server";
import {
  OutriderExportTooLargeError,
  getOutriderZipExport,
} from "@/features/entry/outrider/export";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ outriderId: string }> },
) {
  const params = await context.params;

  try {
    const zip = await getOutriderZipExport(params.outriderId);

    if (!zip) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.redirect(zip.downloadUrl, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
      status: 302,
    });
  } catch (error) {
    if (error instanceof OutriderExportTooLargeError) {
      return NextResponse.json(
        {
          error: "package_too_large",
          message:
            "This Outrider package is too large for a single ZIP. Download the attachments individually.",
        },
        {
          headers: { "Cache-Control": "private, no-store, max-age=0" },
          status: 413,
        },
      );
    }

    console.error("entry_outrider_export_package_failure", error);
    return NextResponse.json(
      {
        error: "package_unavailable",
        message: "The Outrider package could not be prepared.",
      },
      {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
        status: 503,
      },
    );
  }
}
