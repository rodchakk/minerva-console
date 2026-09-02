import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getCommunityUsersPage } from "@/features/entry/users/queries";
import { createClient } from "@/lib/supabase/server";
import { coerceString } from "@/lib/supabase/utils";

export type FieldTicketStatus = "open" | "in_progress" | "resolved";

export type FieldTicket = {
  id: string;
  ticketNumber: string;
  createdBy: string;
  communityId: string | null;
  communityName: string;
  requesterName: string;
  source: string;
  category: string;
  description: string;
  status: FieldTicketStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type FieldTicketMessage = {
  id: string;
  ticketId: string;
  authorId: string;
  authorType: "staff" | "user";
  body: string;
  createdAt: string;
};

export type FieldTicketRequester = {
  authType: string;
  email: string;
  fullName: string;
  houseId: string;
  houseLabel: string;
  isActive: boolean;
  phone: string;
  role: string;
  userId: string;
  username: string;
};

export type FieldTicketDetail = {
  ticket: FieldTicket | null;
  messages: FieldTicketMessage[];
  requester: FieldTicketRequester | null;
  currentStaffUserId: string;
  error: string | null;
};

function normalizeStatus(value: unknown): FieldTicketStatus {
  const normalized = coerceString(value).trim().toLowerCase();
  if (normalized === "in_progress" || normalized === "resolved") {
    return normalized;
  }
  return "open";
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function mapTicket(value: unknown): FieldTicket | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = coerceString(record.id);
  if (!id) return null;

  return {
    id,
    ticketNumber: coerceString(record.ticket_number, "Ticket"),
    createdBy: coerceString(record.created_by),
    communityId: coerceString(record.community_id) || null,
    communityName: coerceString(record.community_name, "Sin comunidad"),
    requesterName: coerceString(record.requester_name, "Usuario ENTRY"),
    source: coerceString(record.source),
    category: coerceString(record.category, "Soporte"),
    description: coerceString(record.description),
    status: normalizeStatus(record.status),
    metadata: normalizeMetadata(record.metadata),
    createdAt: coerceString(record.created_at),
    updatedAt: coerceString(record.updated_at),
    resolvedAt: coerceString(record.resolved_at) || null,
  };
}

function mapMessage(value: unknown): FieldTicketMessage | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = coerceString(record.id);
  const ticketId = coerceString(record.ticket_id);
  const authorType = coerceString(record.author_type).trim().toLowerCase();

  if (!id || !ticketId || !["staff", "user"].includes(authorType)) {
    return null;
  }

  return {
    id,
    ticketId,
    authorId: coerceString(record.author_id),
    authorType: authorType as "staff" | "user",
    body: coerceString(record.body),
    createdAt: coerceString(record.created_at),
  };
}

export async function getFieldTickets(
  status: FieldTicketStatus | null = null,
): Promise<{ tickets: FieldTicket[]; error: string | null }> {
  await requireSuperadmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("support_admin_list_tickets", {
    p_status: status,
  });

  if (error || !Array.isArray(data)) {
    return {
      tickets: [],
      error: error?.message ?? "Support tickets are unavailable.",
    };
  }

  return {
    tickets: data.map(mapTicket).filter((ticket): ticket is FieldTicket => ticket !== null),
    error: null,
  };
}

export async function getFieldTicketDetail(
  ticketId: string,
): Promise<FieldTicketDetail> {
  const { user } = await requireSuperadmin();
  const supabase = await createClient();

  const [{ data: ticketData, error: ticketError }, { data: messageData, error: messageError }] =
    await Promise.all([
      supabase.rpc("support_admin_get_ticket", { p_ticket_id: ticketId }),
      supabase
        .from("support_ticket_messages")
        .select("id,ticket_id,author_id,author_type,body,created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true }),
    ]);

  const ticket = Array.isArray(ticketData) ? mapTicket(ticketData[0]) : null;

  if (ticketError || !ticket) {
    return {
      ticket: null,
      messages: [],
      requester: null,
      currentStaffUserId: user.id,
      error: ticketError?.message ?? "Support ticket was not found.",
    };
  }

  let requester: FieldTicketRequester | null = null;
  if (ticket.communityId && ticket.createdBy) {
    const usersPage = await getCommunityUsersPage(ticket.communityId);
    const userRecord = usersPage.users.find((item) => item.userId === ticket.createdBy) ?? null;
    if (userRecord) {
      requester = {
        authType: userRecord.authType,
        email: userRecord.email,
        fullName: userRecord.fullName,
        houseId: userRecord.houseId,
        houseLabel: userRecord.houseLabel,
        isActive: userRecord.isActive,
        phone: userRecord.phone,
        role: userRecord.role,
        userId: userRecord.userId,
        username: userRecord.username,
      };
    }
  }

  return {
    ticket,
    messages:
      messageError || !Array.isArray(messageData)
        ? []
        : messageData
            .map(mapMessage)
            .filter((message): message is FieldTicketMessage => message !== null),
    requester,
    currentStaffUserId: user.id,
    error: messageError?.message ?? null,
  };
}
