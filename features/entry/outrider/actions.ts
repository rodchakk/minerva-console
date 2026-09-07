"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import {
  getEntryPreviewReadOnlyError,
  getResidentFacingBaseUrl,
} from "@/features/entry/deploymentBoundary";
import {
  decryptOutriderToken,
  encryptOutriderToken,
  hashOutriderToken,
  makeOutriderToken,
  timingSafeHashEqual,
} from "@/features/entry/outrider/token";
import { createAdminClient } from "@/lib/supabase/admin";
import { coerceString } from "@/lib/supabase/utils";

export type OutriderActionResult =
  | {
      data?: {
        link?: string;
        outriderId?: string;
      };
      success: true;
    }
  | {
      code:
        | "conflict"
        | "invalid_input"
        | "invalid_state"
        | "link_unrecoverable"
        | "unauthorized"
        | "unknown";
      error: string;
      success: false;
    };

function getFormString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function mapActionError(error: { code?: string | null; message?: string | null }) {
  const text = error.message ?? "";

  if (error.code === "42501" || /UNAUTHORIZED|INVALID_ACTOR/i.test(text)) {
    return {
      code: "unauthorized" as const,
      error: "Access denied. Superadmin permission required.",
      success: false as const,
    };
  }

  if (/INVALID_COMMUNITY|INVALID_PAYLOAD/i.test(text)) {
    return {
      code: "invalid_input" as const,
      error: "Check the community information and try again.",
      success: false as const,
    };
  }

  if (error.code === "P0409" || /CONFLICT/.test(text)) {
    return {
      code: "conflict" as const,
      error: "This ENTRY community already has an Outrider intake.",
      success: false as const,
    };
  }

  if (/INVALID_STATE|READ_ONLY/.test(text)) {
    return {
      code: "invalid_state" as const,
      error: "This Outrider intake cannot be changed in its current status.",
      success: false as const,
    };
  }

  return {
    code: "unknown" as const,
    error: "Outrider could not complete the request. Please try again.",
    success: false as const,
  };
}

function previewErrorResult(): OutriderActionResult | null {
  const error = getEntryPreviewReadOnlyError();
  return error
    ? {
        code: "unknown",
        error,
        success: false,
      }
    : null;
}

async function buildPublicOutriderUrl(token: string) {
  const baseUrl = await getResidentFacingBaseUrl();
  return `${baseUrl}/entry/outrider/${encodeURIComponent(token)}`;
}

function makeEncryptedTokenPayload() {
  const token = makeOutriderToken();
  return {
    encryptedTokenPayload: encryptOutriderToken(token),
    token,
    tokenHash: hashOutriderToken(token),
  };
}

export async function createOutriderSession(
  _previousState: OutriderActionResult | null,
  formData: FormData,
): Promise<OutriderActionResult> {
  const auth = await requireSuperadmin();
  const previewError = previewErrorResult();
  if (previewError) return previewError;

  const communityId = getFormString(formData, "community_id");
  const communityName = getFormString(formData, "community_name");
  const communityCity = getFormString(formData, "community_city");

  if (!communityId && !communityName) {
    return {
      code: "invalid_input",
      error: "Enter the community name before starting Outrider.",
      success: false,
    };
  }

  if (communityName.length > 180 || communityCity.length > 180) {
    return {
      code: "invalid_input",
      error: "Community name and city must be 180 characters or fewer.",
      success: false,
    };
  }

  let tokenPayload: ReturnType<typeof makeEncryptedTokenPayload>;
  try {
    tokenPayload = makeEncryptedTokenPayload();
  } catch {
    return {
      code: "unknown",
      error: "Outrider link encryption is not configured.",
      success: false,
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "create_community_outrider_session_v2",
    {
      p_actor_user_id: auth.user.id,
      p_community_city: communityCity || null,
      p_community_id: communityId || null,
      p_community_name: communityName || null,
      p_encrypted_token_payload: tokenPayload.encryptedTokenPayload,
      p_token_hash: tokenPayload.tokenHash,
    },
  );

  if (error) return mapActionError(error);

  const outriderId = coerceString((data as Record<string, unknown>)?.outrider_id);
  if (!outriderId) {
    return {
      code: "unknown",
      error: "Outrider was created, but its ID was not returned.",
      success: false,
    };
  }

  revalidatePath("/products/entry");
  revalidatePath("/products/entry/outrider");

  return {
    data: {
      link: await buildPublicOutriderUrl(tokenPayload.token),
      outriderId,
    },
    success: true,
  };
}

export async function rotateOutriderLink(
  _previousState: OutriderActionResult | null,
  formData: FormData,
): Promise<OutriderActionResult> {
  const auth = await requireSuperadmin();
  const previewError = previewErrorResult();
  if (previewError) return previewError;

  const outriderId = getFormString(formData, "outrider_id");
  if (!outriderId) {
    return {
      code: "invalid_input",
      error: "Outrider information is missing.",
      success: false,
    };
  }

  let tokenPayload: ReturnType<typeof makeEncryptedTokenPayload>;
  try {
    tokenPayload = makeEncryptedTokenPayload();
  } catch {
    return {
      code: "unknown",
      error: "Outrider link encryption is not configured.",
      success: false,
    };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("rotate_community_outrider_access_v1", {
    p_actor_user_id: auth.user.id,
    p_encrypted_token_payload: tokenPayload.encryptedTokenPayload,
    p_outrider_id: outriderId,
    p_token_hash: tokenPayload.tokenHash,
  });

  if (error) return mapActionError(error);

  revalidatePath("/products/entry/outrider");
  revalidatePath(`/products/entry/outrider/${outriderId}`);

  return {
    data: {
      link: await buildPublicOutriderUrl(tokenPayload.token),
      outriderId,
    },
    success: true,
  };
}

export async function recoverOutriderLink(input: {
  outriderId: string;
}): Promise<OutriderActionResult> {
  await requireSuperadmin();

  const outriderId = input.outriderId.trim();
  if (!outriderId) {
    return {
      code: "invalid_input",
      error: "Outrider information is missing.",
      success: false,
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("community_outrider_sessions")
    .select("id,token_hash,encrypted_token_payload,status")
    .eq("id", outriderId)
    .maybeSingle();

  if (error || !data) {
    return {
      code: "invalid_state",
      error: "This Outrider intake is not available.",
      success: false,
    };
  }

  const encryptedPayload = coerceString(data.encrypted_token_payload);
  const storedHash = coerceString(data.token_hash);
  if (!encryptedPayload || !storedHash) {
    return {
      code: "link_unrecoverable",
      error: "This Outrider link cannot be recovered. Rotate the link once.",
      success: false,
    };
  }

  try {
    const token = decryptOutriderToken(encryptedPayload);
    const tokenHash = hashOutriderToken(token);

    if (!timingSafeHashEqual(tokenHash, storedHash)) {
      throw new Error("Outrider token hash mismatch.");
    }

    return {
      data: {
        link: await buildPublicOutriderUrl(token),
        outriderId,
      },
      success: true,
    };
  } catch {
    return {
      code: "unknown",
      error: "Could not recover this Outrider link. Rotate it if needed.",
      success: false,
    };
  }
}

export async function requestOutriderInformation(
  _previousState: OutriderActionResult | null,
  formData: FormData,
): Promise<OutriderActionResult> {
  const auth = await requireSuperadmin();
  const previewError = previewErrorResult();
  if (previewError) return previewError;

  const outriderId = getFormString(formData, "outrider_id");
  const note = getFormString(formData, "review_note");

  if (!outriderId || !note) {
    return {
      code: "invalid_input",
      error: "Write a note before requesting more information.",
      success: false,
    };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc(
    "request_community_outrider_information_v1",
    {
      p_actor_user_id: auth.user.id,
      p_outrider_id: outriderId,
      p_review_note: note.slice(0, 1000),
    },
  );

  if (error) return mapActionError(error);

  revalidatePath("/products/entry");
  revalidatePath("/products/entry/outrider");
  revalidatePath(`/products/entry/outrider/${outriderId}`);

  return {
    data: { outriderId },
    success: true,
  };
}

export async function approveOutriderSession(
  _previousState: OutriderActionResult | null,
  formData: FormData,
): Promise<OutriderActionResult> {
  const auth = await requireSuperadmin();
  const previewError = previewErrorResult();
  if (previewError) return previewError;

  const outriderId = getFormString(formData, "outrider_id");
  if (!outriderId) {
    return {
      code: "invalid_input",
      error: "Outrider information is missing.",
      success: false,
    };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("approve_community_outrider_v1", {
    p_actor_user_id: auth.user.id,
    p_outrider_id: outriderId,
  });

  if (error) return mapActionError(error);

  revalidatePath("/products/entry");
  revalidatePath("/products/entry/outrider");
  revalidatePath(`/products/entry/outrider/${outriderId}`);

  return {
    data: { outriderId },
    success: true,
  };
}
