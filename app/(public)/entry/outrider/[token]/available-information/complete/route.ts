import type { NextRequest } from "next/server";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
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
    policies: ["saveShort", "saveHourly"],
    tokenHash,
  });

  if (isOutriderRateLimitDenied(rateLimit)) {
    return outriderRateLimitResponse(rateLimit);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "complete_community_outrider_available_information_v1",
    { p_token_hash: tokenHash },
  );

  if (error) {
    return jsonOutriderResponse(
      { message: "No pudimos guardar esta confirmacion." },
      /READ_ONLY|UNAVAILABLE|42501|P0409/.test(error.message) ? 409 : 400,
    );
  }

  const result = asRecord(data);
  return jsonOutriderResponse({
    completedSections: Array.isArray(result.completed_sections)
      ? result.completed_sections
      : [],
    progressPercent: Number(result.progress_percent ?? 0),
    saved: result.accepted === true,
    status: String(result.status ?? ""),
  });
}
