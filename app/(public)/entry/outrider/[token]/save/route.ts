import type { NextRequest } from "next/server";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { hashOutriderToken } from "@/features/entry/outrider/token";
import { savePublicOutrider } from "@/features/entry/outrider/public/gateway";
import {
  hasOutriderSameOriginBoundary,
  jsonOutriderResponse,
} from "@/features/entry/outrider/public/requestSecurity";
import {
  enforceOutriderRateLimit,
  isOutriderRateLimitDenied,
  outriderRateLimitResponse,
} from "@/features/entry/outrider/public/rateLimit";

export const dynamic = "force-dynamic";

async function readJson(request: NextRequest) {
  const text = await request.text();
  if (text.length > 64_000) return null;

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : null;
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
    policies: ["saveShort", "saveHourly"],
    tokenHash,
  });

  if (isOutriderRateLimitDenied(rateLimit)) {
    return outriderRateLimitResponse(rateLimit);
  }

  const body = await readJson(request);
  if (!body) {
    return jsonOutriderResponse({ message: "Informacion invalida." }, 400);
  }

  const result = await savePublicOutrider({
    payload: body,
    tokenHash,
  });

  if (!result.saved) {
    return jsonOutriderResponse(
      { message: "No pudimos guardar los cambios." },
      /READ_ONLY|UNAVAILABLE|42501|P0409/.test(result.error) ? 409 : 400,
    );
  }

  return jsonOutriderResponse({
    completedSections: result.completedSections,
    saved: true,
    status: result.status,
  });
}
