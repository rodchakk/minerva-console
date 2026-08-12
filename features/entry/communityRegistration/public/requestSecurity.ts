import { NextResponse, type NextRequest } from "next/server";

export function registrationHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
  };
}

export function jsonRegistrationResponse<Body>(body: Body, status = 200) {
  return NextResponse.json(body, {
    headers: registrationHeaders(),
    status,
  });
}

export function hasSameOriginBoundary(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const requestOrigin = new URL(origin).origin;
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const forwardedHost = request.headers.get("x-forwarded-host");
    const host = forwardedHost ?? request.headers.get("host");
    const protocol = forwardedProto ?? request.nextUrl.protocol.replace(/:$/, "");
    const allowedOrigins = new Set([request.nextUrl.origin]);

    if (host) {
      allowedOrigins.add(`${protocol}://${host}`);
    }

    if (!allowedOrigins.has(requestOrigin)) {
      return false;
    }
  } catch {
    return false;
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    return false;
  }

  return true;
}
