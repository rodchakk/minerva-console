import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isVerifiedInvalidSession } from "@/features/auth/authErrorClassification";
import { getSupabaseEnv } from "@/lib/supabase/utils";

function copyCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
  return target;
}

function protectPublicRegistrationResponse(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function protectMachineAuthenticatedResponse(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function redirectWithSessionCookies(
  response: NextResponse,
  redirectUrl: URL,
) {
  return copyCookies(response, NextResponse.redirect(redirectUrl));
}

function redirectToTemporaryUnavailable(
  request: NextRequest,
  response: NextResponse,
) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/temporarily-unavailable";
  redirectUrl.search = "";
  redirectUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return redirectWithSessionCookies(response, redirectUrl);
}

function redirectToLoginAndClearBrokenSession(
  request: NextRequest,
  response: NextResponse,
) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/login";
  redirectUrl.search = "";
  redirectUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  const redirect = redirectWithSessionCookies(response, redirectUrl);
  const cookieNames = new Set([
    ...request.cookies.getAll().map((cookie) => cookie.name),
    ...response.cookies.getAll().map((cookie) => cookie.name),
  ]);

  for (const name of cookieNames) {
    if (name.startsWith("sb-") && name.includes("-auth-token")) {
      redirect.cookies.set(name, "", {
        expires: new Date(0),
        maxAge: 0,
        path: "/",
      });
    }
  }

  return redirect;
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicEntryIntakeRoute =
    pathname === "/entry/register" ||
    pathname.startsWith("/entry/register/") ||
    pathname === "/entry/outrider" ||
    pathname.startsWith("/entry/outrider/") ||
    pathname === "/entry/patronato" ||
    pathname.startsWith("/entry/patronato/");

  if (isPublicEntryIntakeRoute) {
    return protectPublicRegistrationResponse(NextResponse.next({ request }));
  }

  // Service-worker scripts must remain fetchable without an application session.
  // Browsers can update a worker while the PWA is closed or before Supabase auth
  // cookies are available to the navigation context. Returning /login HTML here
  // makes the worker update fail and can leave an installed Android PWA unable to
  // execute the current push handler. The worker is static public code and contains
  // no credentials; keep this bypass exact rather than opening arbitrary .js paths.
  if (pathname === "/minerva-entry-push-sw.js") {
    return NextResponse.next({ request });
  }

  // The automatic ENTRY Web Push dispatcher is machine-authenticated with its
  // own Bearer secret in the route handler. Supabase session middleware must
  // not redirect pg_cron/pg_net requests to /login before that check runs.
  // This bypass applies to this exact path only; the route remains closed by
  // ENTRY_WEB_PUSH_DISPATCH_SECRET and does not become a browser-public API.
  if (pathname === "/api/entry/push/dispatch") {
    return protectMachineAuthenticatedResponse(NextResponse.next({ request }));
  }

  let response = NextResponse.next({
    request,
  });

  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/unauthorized" ||
    pathname === "/temporarily-unavailable" ||
    pathname === "/activate" ||
    pathname.startsWith("/activate/") ||
    pathname === "/reset-password";

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    if (pathname === "/temporarily-unavailable") {
      return response;
    }

    if (isVerifiedInvalidSession(authError)) {
      if (isPublicRoute) {
        return response;
      }

      return redirectToLoginAndClearBrokenSession(request, response);
    }

    // A transport/5xx/rate-limit/unknown Auth failure is not proof that the
    // session is invalid. Keep Supabase cookies and route to a recoverable state.
    return redirectToTemporaryUnavailable(request, response);
  }

  if (!user && !isPublicRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    redirectUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return redirectWithSessionCookies(response, redirectUrl);
  }

  // Note: /login handles authenticated users via getAuthContext() in page.tsx
  // to avoid redirecting non-superadmin users into a /dashboard -> /unauthorized loop.

  return response;
}
