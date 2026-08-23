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

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicRegistrationRoute =
    pathname === "/entry/register" || pathname.startsWith("/entry/register/");

  if (isPublicRegistrationRoute) {
    return protectPublicRegistrationResponse(NextResponse.next({ request }));
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
