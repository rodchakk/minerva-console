import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import {
  SETUP_WORKBOOK_TEMPLATE_FILENAME,
} from "@/features/entry/outrider/setupReport/model";
import { buildSetupWorkbookTemplate } from "@/features/entry/outrider/setupReport/workbook";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireSuperadmin();

  return new NextResponse(buildSetupWorkbookTemplate(), {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename="${SETUP_WORKBOOK_TEMPLATE_FILENAME}"`,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
