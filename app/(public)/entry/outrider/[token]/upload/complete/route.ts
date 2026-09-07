import type { NextRequest } from "next/server";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import {
  isAllowedOutriderFile,
  isOutriderFileCategory,
} from "@/features/entry/outrider/model";
import { recordPublicOutriderFile } from "@/features/entry/outrider/public/gateway";
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

export const dynamic = "force-dynamic";

async function readJson(request: NextRequest) {
  const text = await request.text();
  if (text.length > 16_000) return null;

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
  const storagePath = String(body?.storagePath ?? "");
  const byteSize = Number(body?.byteSize ?? 0);

  if (
    !storagePath ||
    !isOutriderFileCategory(category) ||
    !isAllowedOutriderFile({ byteSize, mimeType, originalFilename })
  ) {
    return jsonOutriderResponse({ message: "Archivo invalido." }, 400);
  }

  const result = await recordPublicOutriderFile({
    byteSize,
    category,
    mimeType,
    originalFilename,
    storagePath,
    tokenHash,
  });

  if (!result.recorded || !result.fileId) {
    return jsonOutriderResponse(
      { message: "No pudimos registrar el archivo." },
      /READ_ONLY|UNAVAILABLE|42501|P0409/.test(result.error ?? "") ? 409 : 400,
    );
  }

  return jsonOutriderResponse({
    file: {
      byteSize,
      category,
      createdAt: new Date().toISOString(),
      id: result.fileId,
      mimeType,
      originalFilename,
      storagePath: result.storagePath,
    },
  });
}
