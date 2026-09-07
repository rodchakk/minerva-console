import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import {
  OUTRIDER_STORAGE_BUCKET,
  buildOutriderStoragePath,
  isAllowedOutriderFile,
  isOutriderEditable,
  isOutriderPublicUploadCategory,
} from "@/features/entry/outrider/model";
import { resolvePublicOutrider } from "@/features/entry/outrider/public/gateway";
import {
  hasOutriderSameOriginBoundary,
  jsonOutriderResponse,
} from "@/features/entry/outrider/public/requestSecurity";
import {
  enforceOutriderRateLimit,
  isOutriderRateLimitDenied,
  outriderRateLimitResponse,
} from "@/features/entry/outrider/public/rateLimit";
import { hashOutriderToken } from "@/features/entry/outrider/token";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function readJson(request: NextRequest) {
  const text = await request.text();
  if (text.length > 8_000) return null;

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const previewError = getEntryPreviewReadOnlyError();
  if (previewError) {
    return jsonOutriderResponse({ message: previewError }, 403);
  }

  if (!hasOutriderSameOriginBoundary(request)) {
    return jsonOutriderResponse({ message: "Solicitud no autorizada." }, 403);
  }

  const params = await context.params;
  const tokenHash = hashOutriderToken(params.token);
  const rateLimit = await enforceOutriderRateLimit(request, {
    policies: ["uploadShort", "uploadHourly"],
    tokenHash,
  });

  if (isOutriderRateLimitDenied(rateLimit)) {
    return outriderRateLimitResponse(rateLimit);
  }

  const body = await readJson(request);
  const category = String(body?.category ?? "");
  const originalFilename = String(body?.originalFilename ?? "");
  const mimeType = String(body?.mimeType ?? "");
  const byteSize = Number(body?.byteSize ?? 0);

  if (
    !isOutriderPublicUploadCategory(category) ||
    !isAllowedOutriderFile({ byteSize, mimeType, originalFilename })
  ) {
    return jsonOutriderResponse(
      {
        message:
          "Archivo invalido. Use XLSX, XLS, CSV, PDF, DOC, DOCX, PNG o JPG de hasta 20 MB.",
      },
      400,
    );
  }

  const session = await resolvePublicOutrider({ tokenHash });
  if (!session.available || !isOutriderEditable(session.status)) {
    return jsonOutriderResponse({ message: "Este enlace no permite cargas." }, 409);
  }

  const path = buildOutriderStoragePath({
    category,
    filename: originalFilename,
    outriderId: session.id,
    uploadId: randomUUID(),
  });
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(OUTRIDER_STORAGE_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data?.token) {
    return jsonOutriderResponse(
      { message: "No pudimos preparar la carga del archivo." },
      503,
    );
  }

  return jsonOutriderResponse({
    path,
    signedToken: data.token,
  });
}
