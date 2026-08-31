import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createClient } from "@/lib/supabase/server";

export type SupportStatus = "open" | "in_progress" | "resolved";

export type EntrySupportTicket = {
  id: string;
  ticketNumber: string;
  createdBy: string;
  communityId: string | null;
  communityName: string;
  requesterName: string;
  source: "mobile" | "web";
  category: string;
  description: string;
  status: SupportStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type EntrySupportMessage = {
  id: string;
  authorId: string;
  authorType: "user" | "staff";
  body: string;
  createdAt: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toTicket(value: unknown): EntrySupportTicket | null {
  const row = asRecord(value);
  const id = asString(row.id);
  const ticketNumber = asString(row.ticket_number);

  if (!id || !ticketNumber) return null;

  const rawStatus = asString(row.status);
  const status: SupportStatus =
    rawStatus === "in_progress" || rawStatus === "resolved" ? rawStatus : "open";

  return {
    id,
    ticketNumber,
    createdBy: asString(row.created_by),
    communityId: asString(row.community_id) || null,
    communityName: asString(row.community_name, "Sin comunidad"),
    requesterName: asString(row.requester_name, "Usuario ENTRY"),
    source: asString(row.source) === "mobile" ? "mobile" : "web",
    category: asString(row.category, "Soporte"),
    description: asString(row.description),
    status,
    metadata: asRecord(row.metadata),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    resolvedAt: asString(row.resolved_at) || null,
  };
}

export async function getEntrySupportTickets(status?: SupportStatus | null) {
  await requireSuperadmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("support_admin_list_tickets", {
    p_status: status ?? null,
  });

  if (error) {
    return { tickets: [] as EntrySupportTicket[], loadError: error.message };
  }

  const tickets = (Array.isArray(data) ? data : [])
    .map(toTicket)
    .filter((ticket): ticket is EntrySupportTicket => ticket !== null);

  return { tickets, loadError: null as string | null };
}

export async function getEntrySupportTicket(ticketId: string) {
  await requireSuperadmin();
  const supabase = await createClient();

  const [{ data: ticketData, error: ticketError }, { data: messageData, error: messageError }] =
    await Promise.all([
      supabase.rpc("support_admin_get_ticket", { p_ticket_id: ticketId }),
      supabase
        .from("support_ticket_messages")
        .select("id,author_id,author_type,body,created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true }),
    ]);

  if (ticketError) {
    return { ticket: null, messages: [] as EntrySupportMessage[], loadError: ticketError.message };
  }

  const firstTicket = Array.isArray(ticketData) ? ticketData[0] : ticketData;
  const ticket = toTicket(firstTicket);

  const messages: EntrySupportMessage[] = (Array.isArray(messageData) ? messageData : [])
    .map((value) => {
      const row = asRecord(value);
      const id = asString(row.id);
      if (!id) return null;
      return {
        id,
        authorId: asString(row.author_id),
        authorType: asString(row.author_type) === "staff" ? "staff" : "user",
        body: asString(row.body),
        createdAt: asString(row.created_at),
      } satisfies EntrySupportMessage;
    })
    .filter((message): message is EntrySupportMessage => message !== null);

  return {
    ticket,
    messages,
    loadError: messageError?.message ?? null,
  };
}
