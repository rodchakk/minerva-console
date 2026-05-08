"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createClient } from "@/lib/supabase/server";

export type EntryMessageMode = "single" | "selected" | "all";

export type SendEntryMessageInput = {
  body: string;
  communityId?: string;
  communityIds?: string[];
  mode: EntryMessageMode;
  title: string;
};

export type SendEntryMessageResult = {
  error?: string;
  result?: unknown;
  success: boolean;
};

function normalizeIds(ids?: string[]) {
  return Array.from(
    new Set(
      (ids ?? [])
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );
}

export async function sendEntryMessageAction(
  input: SendEntryMessageInput,
): Promise<SendEntryMessageResult> {
  await requireSuperadmin();

  const mode = input.mode;
  const title = input.title.trim();
  const body = input.body.trim();
  const communityId = input.communityId?.trim() ?? "";
  const communityIds = normalizeIds(input.communityIds);

  if (!mode) {
    return {
      error: "Choose how you want to publish this message.",
      success: false,
    };
  }

  if (!title) {
    return {
      error: "Title is required.",
      success: false,
    };
  }

  if (!body) {
    return {
      error: "Message body is required.",
      success: false,
    };
  }

  if (mode === "single" && !communityId) {
    return {
      error: "Select a community before publishing.",
      success: false,
    };
  }

  if (mode === "selected" && communityIds.length < 1) {
    return {
      error: "Select at least one community before publishing.",
      success: false,
    };
  }

  const supabase = await createClient();

  if (mode === "single") {
    const { data, error } = await supabase.rpc("sa_send_entry_message", {
      p_body: body,
      p_community_id: communityId,
      p_title: title,
    });

    if (error) {
      return {
        error: error.message,
        success: false,
      };
    }

    revalidatePath("/products/entry/messages");
    revalidatePath("/products/entry/communities");

    return {
      result: data,
      success: true,
    };
  }

  if (mode === "selected") {
    const { data, error } = await supabase.rpc("sa_send_entry_message_many", {
      p_body: body,
      p_community_ids: communityIds,
      p_title: title,
    });

    if (error) {
      return {
        error: error.message,
        success: false,
      };
    }

    revalidatePath("/products/entry/messages");
    revalidatePath("/products/entry/communities");

    return {
      result: data,
      success: true,
    };
  }

  const { data, error } = await supabase.rpc("sa_send_entry_message_all", {
    p_body: body,
    p_title: title,
  });

  if (error) {
    return {
      error: error.message,
      success: false,
    };
  }

  revalidatePath("/products/entry/messages");
  revalidatePath("/products/entry/communities");

  return {
    result: data,
    success: true,
  };
}
