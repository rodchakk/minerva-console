import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const supabase = await createClient();

  if (tokenHash && type === "invite") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "invite",
    });

    if (error) {
      return NextResponse.redirect(new URL("/unauthorized?reason=authorization_error", request.url));
    }

    return NextResponse.redirect(new URL("/console-invite/setup", request.url));
  }

  return NextResponse.redirect(new URL("/login", request.url));
}
