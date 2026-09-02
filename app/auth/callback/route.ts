import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_OTP_TYPES = new Set(["invite", "recovery", "email"]);

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(new URL("/unauthorized?reason=authorization_error", request.url));
    }

    return NextResponse.redirect(new URL("/console-invite/setup", request.url));
  }

  if (tokenHash && type && ALLOWED_OTP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "invite" | "recovery" | "email",
    });

    if (error) {
      return NextResponse.redirect(new URL("/unauthorized?reason=authorization_error", request.url));
    }

    return NextResponse.redirect(new URL("/console-invite/setup", request.url));
  }

  return NextResponse.redirect(new URL("/login", request.url));
}
