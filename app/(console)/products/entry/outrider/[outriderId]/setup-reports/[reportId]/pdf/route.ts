import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  OUTRIDER_EXPORT_STORAGE_BUCKET,
  sanitizeOutriderFilename,
} from "@/features/entry/outrider/model";
import { getOutriderDetail } from "@/features/entry/outrider/queries";

export const dynamic = "force-dynamic";

const SIGNED_REPORT_SECONDS = 5 * 60;

export async function GET(
  request: Request,
  context: { params: Promise<{ outriderId: string; reportId: string }> },
) {
  const params = await context.params;
  const detail = await getOutriderDetail(params.outriderId);
  const report =
    detail?.setupReports.find((item) => item.id === params.reportId) ?? null;

  if (!detail || !report?.pdfStoragePath) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(OUTRIDER_EXPORT_STORAGE_BUCKET)
    .createSignedUrl(report.pdfStoragePath, SIGNED_REPORT_SECONDS);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "report_unavailable" }, { status: 404 });
  }

  const signedUrl = new URL(data.signedUrl);
  const mode = new URL(request.url).searchParams.get("download");
  if (mode === "1") {
    signedUrl.searchParams.set(
      "download",
      `${sanitizeOutriderFilename(detail.communityName)}-setup-report-v${report.version}.pdf`,
    );
  }

  return NextResponse.redirect(signedUrl, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
    status: 302,
  });
}
