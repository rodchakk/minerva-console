import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
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

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicEntryIntakeRoute =
    pathname === "/entry/register" ||
    pathname.startsWith("/entry/register/") ||
    pathname === "/entry/outrider" ||
    pathname.startsWith("/entry/outrider/");

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/unauthorized" ||
    pathname === "/activate" ||
    pathname.startsWith("/activate/") ||
    pathname === "/reset-password";

  if (!user && !isPublicRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return copyCookies(response, NextResponse.redirect(redirectUrl));
  }

  // Note: /login handles authenticated users via getAuthContext() in page.tsx
  // to avoid redirecting non-superadmin users into a /dashboard -> /unauthorized loop.

  return response;
}
