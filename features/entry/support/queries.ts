import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createClient } from "@/lib/supabase/server";

export type SupportStatus = "open" | "in_progress" | "resolved";
export type SupportWorkflowState = SupportStatus | "waiting_user";
export type SupportInboxFilter = SupportWorkflowState | "unread";

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
  waitingOnUser: boolean;
  workflowState: SupportWorkflowState;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  unreadCount: number;
  lastUserActivityAt: string;
  lastMessageAt: string;
  lastMessageAuthorType: "user" | "staff";
  lastReadAt: string | null;
};

export type EntrySupportRequester = {
  email: string;
  fullName: string;
  houseLabel: string;
  role: string;
  userId: string;
  username: string;
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

function asNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toTicket(value: unknown): EntrySupportTicket | null {
  const row = asRecord(value);
  const id = asString(row.id);
  const ticketNumber = asString(row.ticket_number);

  if (!id || !ticketNumber) return null;

  const rawStatus = asString(row.status);
  const status: SupportStatus =
    rawStatus === "in_progress" || rawStatus === "resolved" ? rawStatus : "open";
  const waitingOnUser = status === "in_progress" && row.waiting_on_user === true;
  const workflowState: SupportWorkflowState = waitingOnUser ? "waiting_user" : status;
  const createdAt = asString(row.created_at);
  const updatedAt = asString(row.updated_at);

  return {
    id,
    ticketNumber,
    createdBy: asString(row.created_by),
    communityId: asString(row.community_id) || null,
    communityName: asString(row.community_name, "No community"),
    requesterName: asString(row.requester_name, "ENTRY user"),
    source: asString(row.source) === "mobile" ? "mobile" : "web",
    category: asString(row.category, "Support"),
    description: asString(row.description),
    status,
    waitingOnUser,
    workflowState,
    metadata: asRecord(row.metadata),
    createdAt,
    updatedAt,
    resolvedAt: asString(row.resolved_at) || null,
    unreadCount: Math.max(0, Math.trunc(asNumber(row.unread_count))),
    lastUserActivityAt: asString(row.last_user_activity_at) || createdAt,
    lastMessageAt: asString(row.last_message_at) || updatedAt || createdAt,
    lastMessageAuthorType:
      asString(row.last_message_author_type) === "staff" ? "staff" : "user",
    lastReadAt: asString(row.last_read_at) || null,
  };
}

function toRequester(value: unknown): EntrySupportRequester | null {
  const row = asRecord(value);
  const userId = asString(row.user_id) || asString(row.id);

  if (!userId) return null;

  return {
    email: asString(row.email).trim().toLowerCase(),
    fullName:
      asString(row.full_name) ||
      asString(row.name) ||
      asString(row.display_name) ||
      asString(row.username) ||
      "ENTRY user",
    houseLabel:
      asString(row.house_label) ||
      asString(row.unit_label) ||
      "",
    role: asString(row.role).trim().toUpperCase(),
    userId,
    username: asString(row.username),
  };
}

export async function getEntrySupportTickets(filter?: SupportInboxFilter | null) {
  await requireSuperadmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("support_admin_list_tickets_v2", {
    p_filter: filter ?? null,
  });

  if (error) {
    console.error("[entry-support] failed to list support tickets", {
      code: error.code,
      message: error.message,
    });
    return {
      tickets: [] as EntrySupportTicket[],
      loadError: "Tickets could not be loaded. Try again.",
    };
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
      supabase.rpc("support_admin_get_ticket_v2", { p_ticket_id: ticketId }),
      supabase
        .from("support_ticket_messages")
        .select("id,author_id,author_type,body,created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true }),
    ]);

  if (ticketError) {
    console.error("[entry-support] failed to load support ticket", {
      code: ticketError.code,
      message: ticketError.message,
    });
    return {
      ticket: null,
      messages: [] as EntrySupportMessage[],
      requester: null as EntrySupportRequester | null,
      loadError: "Ticket could not be loaded. Try again.",
    };
  }

  const firstTicket = Array.isArray(ticketData) ? ticketData[0] : ticketData;
  const ticket = toTicket(firstTicket);
  let requester: EntrySupportRequester | null = null;

  if (ticket?.communityId && ticket.createdBy) {
    const { data: requesterData } = await supabase.rpc("sa_list_community_users", {
      p_community_id: ticket.communityId,
      p_include_inactive: true,
    });

    requester =
      (Array.isArray(requesterData) ? requesterData : [])
        .map(toRequester)
        .find((item) => item?.userId === ticket.createdBy) ?? null;
  }

  if (messageError) {
    console.error("[entry-support] failed to load support conversation", {
      code: messageError.code,
      message: messageError.message,
    });
  }

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
    requester,
    loadError: messageError
      ? "The ticket loaded, but the conversation could not be loaded. Try again."
      : null,
  };
}
