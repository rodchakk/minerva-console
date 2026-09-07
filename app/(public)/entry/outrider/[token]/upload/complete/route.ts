import type { NextRequest } from "next/server";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import {
  OUTRIDER_STORAGE_BUCKET,
  isAllowedOutriderFile,
  isOutriderEditable,
  isOutriderFileCategory,
  sanitizeOutriderFilename,
} from "@/features/entry/outrider/model";
import {
  recordPublicOutriderFile,
  resolvePublicOutrider,
} from "@/features/entry/outrider/public/gateway";
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

function storageMetadata(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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
  const declaredMimeType = String(body?.mimeType ?? "");
  const storagePath = String(body?.storagePath ?? "");
  const declaredByteSize = Number(body?.byteSize ?? 0);

  if (
    !storagePath ||
    !isOutriderFileCategory(category) ||
    !isAllowedOutriderFile({
      byteSize: declaredByteSize,
      mimeType: declaredMimeType,
      originalFilename,
    })
  ) {
    return jsonOutriderResponse({ message: "Archivo invalido." }, 400);
  }

  const session = await resolvePublicOutrider({ tokenHash });
  if (!session.available || !isOutriderEditable(session.status)) {
    return jsonOutriderResponse({ message: "Este enlace no permite cargas." }, 409);
  }

  const expectedPrefix = `${session.id}/${category}/`;
  const expectedFilenameSuffix = `-${sanitizeOutriderFilename(originalFilename)}`;
  if (
    !storagePath.startsWith(expectedPrefix) ||
    !storagePath.endsWith(expectedFilenameSuffix)
  ) {
    return jsonOutriderResponse({ message: "Ruta de archivo invalida." }, 400);
  }

  const slashIndex = storagePath.lastIndexOf("/");
  const folder = storagePath.slice(0, slashIndex);
  const objectName = storagePath.slice(slashIndex + 1);
  if (!folder || !objectName) {
    return jsonOutriderResponse({ message: "Ruta de archivo invalida." }, 400);
  }

  const supabase = createAdminClient();
  const { data: objects, error: listError } = await supabase.storage
    .from(OUTRIDER_STORAGE_BUCKET)
    .list(folder, {
      limit: 10,
      search: objectName,
    });

  const storedObject = objects?.find((object) => object.name === objectName);
  if (listError || !storedObject) {
    return jsonOutriderResponse(
      { message: "No pudimos verificar el archivo cargado." },
      409,
    );
  }

  const metadata = storageMetadata(storedObject.metadata);
  const actualByteSize = Number(metadata.size ?? 0);
  const actualMimeType = String(
    metadata.mimetype ?? metadata.contentType ?? "",
  );

  if (
    actualByteSize !== declaredByteSize ||
    actualMimeType !== declaredMimeType ||
    !isAllowedOutriderFile({
      byteSize: actualByteSize,
      mimeType: actualMimeType,
      originalFilename,
    })
  ) {
    return jsonOutriderResponse(
      { message: "El archivo cargado no coincide con la informacion enviada." },
      409,
    );
  }

  const result = await recordPublicOutriderFile({
    byteSize: actualByteSize,
    category,
    mimeType: actualMimeType,
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
      byteSize: actualByteSize,
      category,
      createdAt: new Date().toISOString(),
      id: result.fileId,
      mimeType: actualMimeType,
      originalFilename,
      storagePath: result.storagePath,
    },
  });
}
