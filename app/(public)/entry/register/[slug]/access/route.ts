import { NextResponse, type NextRequest } from "next/server";
import {
  CAMPAIGN_ACCESS_MAX_AGE_SECONDS,
  createCampaignAccessCookieValue,
  getCampaignAccessCookieName,
  getCampaignAccessCookiePath,
  hashRegistrationToken,
  normalizePublicSlug,
} from "@/features/entry/communityRegistration/public/accessState";
import { resolveCommunityRegistrationCampaign } from "@/features/entry/communityRegistration/public/gateway";

export const dynamic = "force-dynamic";

function registrationHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
  };
}

function cleanRegistrationUrl(request: NextRequest, slug: string) {
  return new URL(`/entry/register/${encodeURIComponent(slug)}`, request.url);
}

function redirectWithoutAccess(request: NextRequest, slug: string) {
  const response = NextResponse.redirect(cleanRegistrationUrl(request, slug), {
    headers: registrationHeaders(),
    status: 303,
  });

  response.cookies.set({
    name: getCampaignAccessCookieName(slug),
    value: "",
    httpOnly: true,
    maxAge: 0,
    path: getCampaignAccessCookiePath(slug),
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

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
    return redirectWithoutAccess(request, slug || rawSlug);
  }

  const tokenHash = hashRegistrationToken(token);
  const campaign = await resolveCommunityRegistrationCampaign({
    publicSlug: slug,
    tokenHash,
  });

  if (!campaign.available) {
    return redirectWithoutAccess(request, slug);
  }

  const response = NextResponse.redirect(cleanRegistrationUrl(request, slug), {
    headers: registrationHeaders(),
    status: 303,
  });

  response.cookies.set({
    name: getCampaignAccessCookieName(slug),
    value: createCampaignAccessCookieValue({ slug, tokenHash }),
    httpOnly: true,
    maxAge: CAMPAIGN_ACCESS_MAX_AGE_SECONDS,
    path: getCampaignAccessCookiePath(slug),
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
