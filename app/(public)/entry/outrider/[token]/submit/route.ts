import type { NextRequest } from "next/server";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { submitPublicOutrider } from "@/features/entry/outrider/public/gateway";
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
    policies: ["submitShort", "submitHourly"],
    tokenHash,
  });

  if (isOutriderRateLimitDenied(rateLimit)) {
    return outriderRateLimitResponse(rateLimit);
  }

  const result = await submitPublicOutrider({ tokenHash });

  if (!result.submitted) {
    return jsonOutriderResponse(
      { message: "Revise la informacion antes de enviarla." },
      /READ_ONLY|UNAVAILABLE|42501|P0409/.test(result.error ?? "") ? 409 : 400,
    );
  }

  return jsonOutriderResponse({
    completedSections: result.completedSections,
    submitted: true,
  });
}
