import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  OUTRIDER_STORAGE_BUCKET,
  sanitizeOutriderFilename,
} from "@/features/entry/outrider/model";
import { getOutriderDetail } from "@/features/entry/outrider/queries";

export const dynamic = "force-dynamic";

const SIGNED_DOWNLOAD_SECONDS = 5 * 60;

export async function GET(
  _request: Request,
  context: { params: Promise<{ fileId: string; outriderId: string }> },
) {
  const params = await context.params;
  const detail = await getOutriderDetail(params.outriderId);
  const file = detail?.files.find((item) => item.id === params.fileId);

  if (!detail || !file) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(OUTRIDER_STORAGE_BUCKET)
    .createSignedUrl(file.storagePath, SIGNED_DOWNLOAD_SECONDS);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "file_unavailable" }, { status: 404 });
  }

  const downloadUrl = new URL(data.signedUrl);
  downloadUrl.searchParams.set(
    "download",
    sanitizeOutriderFilename(file.originalFilename),
  );

  return NextResponse.redirect(downloadUrl, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
    status: 302,
  });
}
