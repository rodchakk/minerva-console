import type { NextRequest } from "next/server";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return Response.json(
      { error: "preview_read_only", success: false },
      { status: 403 },
    );
  }

  let pin = "";
  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown; pin?: unknown };
    pin = String(body.pin ?? "").trim();
    password = String(body.password ?? "");
  } catch {
    return Response.json({ error: "invalid_request", success: false }, { status: 400 });
  }

  if (!/^\d{6}$/.test(pin) || password.length < 8) {
    return Response.json({ error: "invalid_request", success: false }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_resident_activation_pin_v1", {
    p_password: password,
    p_pin: pin,
  });

  if (error) {
    return Response.json({ error: "service_unavailable", success: false }, { status: 502 });
  }

  return Response.json(data ?? { success: false });
}
