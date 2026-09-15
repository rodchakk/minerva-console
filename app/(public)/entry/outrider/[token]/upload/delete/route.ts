import type { NextRequest } from "next/server";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { OUTRIDER_STORAGE_BUCKET } from "@/features/entry/outrider/model";
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
  if (text.length > 4_000) return null;

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown) {
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
  const fileId = String(body?.fileId ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(fileId)) {
    return jsonOutriderResponse({ message: "Archivo inválido." }, 400);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("delete_community_outrider_file_v1", {
    p_file_id: fileId,
    p_token_hash: tokenHash,
  });

  if (error) {
    const conflict = /READ_ONLY|UNAVAILABLE|P0409|42501/.test(
      `${error.code ?? ""} ${error.message ?? ""}`,
    );
    return jsonOutriderResponse(
      {
        message: conflict
          ? "Este archivo ya no se puede eliminar desde este enlace."
          : "No pudimos eliminar el archivo.",
      },
      conflict ? 409 : 400,
    );
  }

  const result = asRecord(data);
  const storagePath = String(result.storage_path ?? "").trim();
  if (result.accepted !== true || !storagePath) {
    return jsonOutriderResponse({ message: "No pudimos eliminar el archivo." }, 409);
  }

  // Database state is authoritative for the public workflow. Storage cleanup is
  // best-effort so a transient object-store failure cannot leave the intake stuck
  // with a file record the patronato can no longer replace.
  const { error: storageError } = await supabase.storage
    .from(OUTRIDER_STORAGE_BUCKET)
    .remove([storagePath]);

  if (storageError) {
    console.error("ENTRY Outrider source-file storage cleanup failed", {
      fileId,
      storagePath,
      message: storageError.message,
    });
  }

  return jsonOutriderResponse({ deleted: true, fileId });
}
