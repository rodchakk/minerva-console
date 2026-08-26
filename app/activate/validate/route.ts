import type { NextRequest } from "next/server";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return Response.json({ error: "preview_read_only", valid: false }, { status: 403 });
  }

  let pin = "";
  try {
    const body = (await request.json()) as { pin?: unknown };
    pin = String(body.pin ?? "").trim();
  } catch {
    return Response.json({ error: "invalid_request", valid: false }, { status: 400 });
  }

  if (!/^\d{6}$/.test(pin)) {
    return Response.json({ error: "invalid_pin", valid: false }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("validate_resident_activation_pin_v1", {
    p_pin: pin,
  });

  if (error) {
    return Response.json({ error: "service_unavailable", valid: false }, { status: 502 });
  }

  return Response.json(data ?? { valid: false });
}
