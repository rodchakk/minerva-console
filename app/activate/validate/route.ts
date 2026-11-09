import type { NextRequest } from "next/server";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import {
  enforceActivationValidateRateLimit,
  isRateLimitDenied,
  rateLimitJsonResponse,
} from "@/features/entry/communityRegistration/public/rateLimit";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return Response.json({ error: "preview_read_only", valid: false }, { status: 403 });
  }

  const rateLimit = await enforceActivationValidateRateLimit(request);
  if (isRateLimitDenied(rateLimit)) {
    return rateLimitJsonResponse(rateLimit);
  }

  let activationId = "";
  let pin = "";
  try {
    const body = (await request.json()) as { activationId?: unknown; pin?: unknown };
    activationId = String(body.activationId ?? "").trim();
    pin = String(body.pin ?? "").trim();
  } catch {
    return Response.json({ error: "invalid_request", valid: false }, { status: 400 });
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(activationId) || !/^\d{6}$/.test(pin)) {
    return Response.json({ error: "invalid_pin", valid: false }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("validate_resident_activation_pin_v2", {
    p_activation_id: activationId,
    p_pin: pin,
  });

  if (error) {
    return Response.json({ error: "service_unavailable", valid: false }, { status: 502 });
  }

  return Response.json(data ?? { valid: false });
}
