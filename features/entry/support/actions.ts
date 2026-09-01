"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { resetFieldResidentAccess } from "@/features/entry/field/peopleActions";
import { getEntrySupportTicket } from "@/features/entry/support/queries";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_STATUSES = new Set(["open", "in_progress", "resolved"]);

function ticketPath(ticketId: string, key?: string) {
  const base = `/products/entry/tickets/${ticketId}`;
  return key ? `${base}?${key}=1` : base;
}

export type SupportResetRequesterAccessState = {
  code?: string;
  error?: string;
  expiresAt?: string | null;
  mode?: "email" | "recovery_code" | "unsupported";
  success?: boolean;
};

export async function replyToEntrySupportTicket(formData: FormData) {
  await requireSuperadmin();

  const ticketId = String(formData.get("ticketId") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!UUID_PATTERN.test(ticketId)) redirect("/products/entry/tickets");
  if (!body || body.length > 4000) redirect(`${ticketPath(ticketId)}?error=message`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("support_add_message", {
    p_ticket_id: ticketId,
    p_body: body,
  });

  if (error) redirect(`${ticketPath(ticketId)}?error=reply`);

  revalidatePath("/products/entry/tickets");
  revalidatePath(ticketPath(ticketId));
  redirect(ticketPath(ticketId, "sent"));
}

export async function updateEntrySupportTicketStatus(formData: FormData) {
  await requireSuperadmin();

  const ticketId = String(formData.get("ticketId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!UUID_PATTERN.test(ticketId)) redirect("/products/entry/tickets");
  if (!VALID_STATUSES.has(status)) redirect(`${ticketPath(ticketId)}?error=status`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("support_update_status", {
    p_ticket_id: ticketId,
    p_status: status,
  });

  if (error) redirect(`${ticketPath(ticketId)}?error=status`);

  revalidatePath("/products/entry/tickets");
  revalidatePath(ticketPath(ticketId));
  redirect(ticketPath(ticketId, "updated"));
}

export async function resetEntrySupportRequesterAccess(
  _previousState: SupportResetRequesterAccessState,
  formData: FormData,
): Promise<SupportResetRequesterAccessState> {
  await requireSuperadmin();

  const ticketId = String(formData.get("ticketId") ?? "").trim();

  if (!UUID_PATTERN.test(ticketId)) {
    return {
      error: "Ticket information is invalid.",
      mode: "unsupported",
      success: false,
    };
  }

  const { ticket } = await getEntrySupportTicket(ticketId);

  if (!ticket) {
    return {
      error: "Ticket was not found.",
      mode: "unsupported",
      success: false,
    };
  }

  if (!ticket.communityId || !ticket.createdBy) {
    return {
      error: "Requester community information is incomplete.",
      mode: "unsupported",
      success: false,
    };
  }

  const result = await resetFieldResidentAccess({
    communityId: ticket.communityId,
    userId: ticket.createdBy,
  });

  revalidatePath(ticketPath(ticket.id));

  return result;
}
