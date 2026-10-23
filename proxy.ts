import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // Temporary security verification: private Preview logs; removed after observation.
  if (process.env.VERCEL_ENV === "preview") {
    console.info("MINERVA-SECURITY-001 runtime-proxy", process.version);
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$).*)",
  ],
};
