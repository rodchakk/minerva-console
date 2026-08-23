import type { NextRequest } from "next/server";
import { normalizePublicSlug } from "@/features/entry/communityRegistration/public/accessState";
import {
  clearCorrectionAccessCookieOptions,
  getCorrectionAccessCookieName,
  readCorrectionAccessCookieValue,
} from "@/features/entry/communityRegistration/public/correctionAccessState";
import {
  resolveCommunityRegistrationEdit,
  resubmitCommunityRegistrationHousehold,
} from "@/features/entry/communityRegistration/public/gateway";
import {
  enforceCorrectionSubmissionRateLimit,
  isRateLimitDenied,
  rateLimitJsonResponse,
} from "@/features/entry/communityRegistration/public/rateLimit";
import {
  hasSameOriginBoundary,
  jsonRegistrationResponse,
} from "@/features/entry/communityRegistration/public/requestSecurity";
import { parseHouseholdCorrectionSubmissionBody } from "@/features/entry/communityRegistration/public/submissionPayload";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";

export const dynamic = "force-dynamic";

// Transport security ceiling only. The backend RPC remains the authority for
// resident-count limits through the current correction effective resident limit.
const MAX_SUBMISSION_BODY_BYTES = 1024 * 1024;

type PublicCorrectionSubmissionResponse =
  | {
      submitted: true;
    }
  | {
      error:
        | "access_unavailable"
        | "invalid_request"
        | "payload_too_large"
        | "rate_limited"
        | "service_unavailable"
        | "try_again";
      submitted: false;
    };

type JsonBodyResult =
  | {
      body: unknown;
      ok: true;
    }
  | {
      error: "invalid_request" | "payload_too_large";
      ok: false;
    };

function correctionSubmissionResponse(
  body: PublicCorrectionSubmissionResponse,
  status = 200,
) {
  return jsonRegistrationResponse(body, status);
}

function clearCorrectionCookie(
  response: ReturnType<typeof correctionSubmissionResponse>,
  slug: string,
) {
  response.cookies.set(clearCorrectionAccessCookieOptions(slug));
  return response;
}

function correctionAccessUnavailable(slug: string) {
  return clearCorrectionCookie(
    correctionSubmissionResponse(
      { error: "access_unavailable", submitted: false },
      401,
    ),
    slug,
  );
}

function hasJsonContentType(request: NextRequest) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  return contentType.split(";")[0]?.trim() === "application/json";
}

async function readJsonBody(request: NextRequest): Promise<JsonBodyResult> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_SUBMISSION_BODY_BYTES) {
    return { error: "payload_too_large", ok: false };
  }

  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return { error: "invalid_request", ok: false };
  }

  if (new TextEncoder().encode(rawBody).length > MAX_SUBMISSION_BODY_BYTES) {
    return { error: "payload_too_large", ok: false };
  }

  try {
    return { body: JSON.parse(rawBody) as unknown, ok: true };
  } catch {
    return { error: "invalid_request", ok: false };
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return correctionSubmissionResponse(
      { error: "service_unavailable", submitted: false },
      403,
    );
  }

  if (!hasSameOriginBoundary(request)) {
    return correctionSubmissionResponse(
      { error: "access_unavailable", submitted: false },
      403,
    );
  }

  if (!hasJsonContentType(request)) {
    return correctionSubmissionResponse(
      { error: "invalid_request", submitted: false },
      415,
    );
  }

  const { slug: rawSlug } = await context.params;
  const slug = normalizePublicSlug(rawSlug);

  if (!slug) {
    return correctionSubmissionResponse(
      { error: "access_unavailable", submitted: false },
      404,
    );
  }

  const correctionState = readCorrectionAccessCookieValue({
    cookieValue: request.cookies.get(getCorrectionAccessCookieName(slug))?.value,
    slug,
  });

  if (!correctionState) {
    return correctionAccessUnavailable(slug);
  }

  const rateLimitDecision = await enforceCorrectionSubmissionRateLimit({
    editTokenHash: correctionState.editTokenHash,
    slug,
  });

  if (isRateLimitDenied(rateLimitDecision)) {
    return rateLimitJsonResponse(rateLimitDecision, { includeSubmitted: true });
  }

  const correction = await resolveCommunityRegistrationEdit({
    editTokenHash: correctionState.editTokenHash,
  });

  if (
    !correction.available ||
    normalizePublicSlug(correction.publicSlug) !== slug
  ) {
    return correctionAccessUnavailable(slug);
  }

  const jsonBody = await readJsonBody(request);
  if (!jsonBody.ok) {
    return correctionSubmissionResponse(
      { error: jsonBody.error, submitted: false },
      jsonBody.error === "payload_too_large" ? 413 : 400,
    );
  }

  const parsedBody = parseHouseholdCorrectionSubmissionBody(jsonBody.body);
  if (!parsedBody.ok) {
    return correctionSubmissionResponse(
      { error: "invalid_request", submitted: false },
      400,
    );
  }

  if (parsedBody.body.residents.length > correction.effectiveResidentLimit) {
    return correctionSubmissionResponse(
      { error: "invalid_request", submitted: false },
      400,
    );
  }

  const submission = await resubmitCommunityRegistrationHousehold({
    editTokenHash: correctionState.editTokenHash,
    residents: parsedBody.body.residents,
  });

  if (submission.submitted) {
    return clearCorrectionCookie(correctionSubmissionResponse({ submitted: true }), slug);
  }

  if (submission.reason === "access_unavailable") {
    return correctionAccessUnavailable(slug);
  }

  return correctionSubmissionResponse(
    { error: "try_again", submitted: false },
    502,
  );
}
