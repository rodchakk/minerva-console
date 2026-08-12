import { NextResponse, type NextRequest } from "next/server";
import { normalizePublicSlug } from "@/features/entry/communityRegistration/public/accessState";
import {
  clearCorrectionAccessCookieOptions,
  createCorrectionAccessCookieValue,
  getCorrectionAccessCookieName,
  getCorrectionAccessCookiePath,
  getCorrectionAccessMaxAgeSeconds,
  hashCorrectionToken,
} from "@/features/entry/communityRegistration/public/correctionAccessState";
import { resolveCommunityRegistrationEdit } from "@/features/entry/communityRegistration/public/gateway";
import {
  enforceCorrectionAccessRateLimit,
  isRateLimitDenied,
  rateLimitJsonResponse,
} from "@/features/entry/communityRegistration/public/rateLimit";
import { registrationHeaders } from "@/features/entry/communityRegistration/public/requestSecurity";

export const dynamic = "force-dynamic";

function cleanCorrectionUrl(request: NextRequest, slug: string) {
  return new URL(
    `/entry/register/${encodeURIComponent(slug)}/correct`,
    request.url,
  );
}

function redirectWithoutCorrectionAccess(request: NextRequest, slug: string) {
  const normalizedSlug = normalizePublicSlug(slug);
  const response = NextResponse.redirect(
    cleanCorrectionUrl(request, normalizedSlug || slug),
    {
      headers: registrationHeaders(),
      status: 303,
    },
  );

  if (normalizedSlug) {
    response.cookies.set(clearCorrectionAccessCookieOptions(normalizedSlug));
  }

  return response;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await context.params;
  const slug = normalizePublicSlug(rawSlug);
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";

  if (!slug || !token) {
    return redirectWithoutCorrectionAccess(request, slug || rawSlug);
  }

  const editTokenHash = hashCorrectionToken(token);
  const rateLimitDecision = await enforceCorrectionAccessRateLimit(request, {
    editTokenHash,
    slug,
  });

  if (isRateLimitDenied(rateLimitDecision)) {
    return rateLimitJsonResponse(rateLimitDecision);
  }

  const correction = await resolveCommunityRegistrationEdit({ editTokenHash });

  if (
    !correction.available ||
    normalizePublicSlug(correction.publicSlug) !== slug
  ) {
    return redirectWithoutCorrectionAccess(request, slug);
  }

  const maxAge = getCorrectionAccessMaxAgeSeconds(correction.expiresAt);
  if (maxAge <= 0) {
    return redirectWithoutCorrectionAccess(request, slug);
  }

  const response = NextResponse.redirect(cleanCorrectionUrl(request, slug), {
    headers: registrationHeaders(),
    status: 303,
  });

  response.cookies.set({
    name: getCorrectionAccessCookieName(slug),
    value: createCorrectionAccessCookieValue({
      editTokenHash,
      expiresAt: correction.expiresAt,
      slug,
    }),
    httpOnly: true,
    maxAge,
    path: getCorrectionAccessCookiePath(slug),
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
