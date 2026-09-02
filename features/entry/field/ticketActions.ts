"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import type { FieldTicketStatus } from "@/features/entry/field/ticketData";
import { createClient } from "@/lib/supabase/server";

export type FieldTicketActionResult = {
  error?: string;
  success: boolean;
};

function revalidateTicketPaths(ticketId: string) {
  revalidatePath("/field/entry");
  revalidatePath("/field/entry/tickets");
  revalidatePath(`/field/entry/tickets/${ticketId}`);
  revalidatePath("/products/entry/tickets");
}

export async function sendFieldTicketMessage(input: {
  ticketId: string;
  body: string;
}): Promise<FieldTicketActionResult> {
  await requireSuperadmin();

  const previewReadOnlyError = getEntryPreviewReadOnlyError();
  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  const ticketId = input.ticketId.trim();
  const body = input.body.trim();

  if (!ticketId) {
    return { error: "Ticket is required.", success: false };
  }
  if (!body || body.length > 4000) {
    return {
      error: "Message must be between 1 and 4000 characters.",
      success: false,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("support_add_message", {
    p_ticket_id: ticketId,
    p_body: body,
  });

  if (error) {
    return { error: error.message, success: false };
  }

  revalidateTicketPaths(ticketId);
  return { success: true };
}

export async function updateFieldTicketStatus(input: {
  ticketId: string;
  status: FieldTicketStatus;
}): Promise<FieldTicketActionResult> {
  await requireSuperadmin();

  const previewReadOnlyError = getEntryPreviewReadOnlyError();
  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  const ticketId = input.ticketId.trim();
  const status = input.status;
  if (!ticketId || !["open", "in_progress", "resolved"].includes(status)) {
    return { error: "Invalid ticket status.", success: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("support_update_status", {
    p_ticket_id: ticketId,
    p_status: status,
  });

  if (error) {
    return { error: error.message, success: false };
  }

  revalidateTicketPaths(ticketId);
  return { success: true };
}
