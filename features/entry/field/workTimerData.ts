import "server-only";

import { getCommunitiesWithProgressResult } from "@/features/entry/communities/queries";
import {
  FIELD_WORK_OPERATING_TIME_ZONE,
  FIELD_WORK_PRODUCT_KEY,
  formatFieldOperatingMonthLabel,
  formatFieldWorkDuration,
  getFieldOperatingMonthRange,
  getFieldWorkClassificationLabel,
  getFieldWorkLocationLabel,
  getFieldWorkTargetLabel,
  isCompletedFieldWorkSession,
  isFieldWorkClassification,
  isFieldWorkLocation,
  isFieldWorkSessionStatus,
  isFieldWorkTargetScope,
  normalizeFieldOperatingMonth,
  shiftFieldOperatingMonth,
  summarizeFieldWorkMonth,
  type FieldActiveWorkTimer,
  type FieldWorkCommunityOption,
  type FieldWorkMonthlySummary,
  type FieldWorkSession,
} from "@/features/entry/field/workTimerModel";
import { createClient } from "@/lib/supabase/server";
import { coerceNumber, coerceString } from "@/lib/supabase/utils";

type FieldWorkStaffUser = {
  email?: string | null;
  id: string;
};

export type FieldWorkTimerPageData = {
  activeSession: FieldActiveWorkTimer | null;
  communities: FieldWorkCommunityOption[];
  copySummary: string;
  error: string | null;
  historyLimit: number;
  historyTruncated: boolean;
  month: string;
  nextMonth: string;
  operatingTimeZone: typeof FIELD_WORK_OPERATING_TIME_ZONE;
  previousMonth: string;
  sessions: FieldWorkSession[];
  staffEmail: string;
  summary: FieldWorkMonthlySummary;
  summarySessionCount: number;
};

const FIELD_WORK_HISTORY_LIMIT = 100;
const FIELD_WORK_MONTH_PAGE_SIZE = 1000;

const fieldWorkSessionSelect = [
  "id",
  "target_scope",
  "product_key",
  "community_id",
  "community_id_snapshot",
  "community_name_snapshot",
  "classification",
  "work_location",
  "status",
  "notes",
  "started_at",
  "stopped_at",
  "duration_seconds",
].join(",");

function formatSessionDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    timeZone: FIELD_WORK_OPERATING_TIME_ZONE,
  }).format(date);
}

function formatSessionTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FIELD_WORK_OPERATING_TIME_ZONE,
    timeZoneName: "short",
  }).format(date);
}

function normalizeCommunityName(
  targetScope: FieldWorkSession["targetScope"],
  communityId: string | null,
  snapshot: string,
  communities: FieldWorkCommunityOption[],
) {
  if (targetScope === "PRODUCT") {
    return "ENTRY general";
  }

  return (
    snapshot ||
    communities.find((community) => community.id === communityId)?.name ||
    "Unknown client"
  );
}

function mapWorkSession(
  item: unknown,
  communities: FieldWorkCommunityOption[],
): FieldWorkSession | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const id = coerceString(record.id);
  const targetScope = coerceString(record.target_scope);
  const productKey = coerceString(record.product_key);
  const classification = coerceString(record.classification);
  const location = coerceString(record.work_location);
  const status = coerceString(record.status);
  const startedAt = coerceString(record.started_at);

  if (
    !id ||
    !isFieldWorkTargetScope(targetScope) ||
    productKey !== FIELD_WORK_PRODUCT_KEY ||
    !isFieldWorkClassification(classification) ||
    !isFieldWorkLocation(location) ||
    !isFieldWorkSessionStatus(status) ||
    !startedAt
  ) {
    return null;
  }

  const communityId = coerceString(record.community_id) || null;
  const communityIdSnapshot = coerceString(record.community_id_snapshot) || null;
  const stoppedAt = coerceString(record.stopped_at) || null;
  const duration =
    record.duration_seconds === null || record.duration_seconds === undefined
      ? null
      : coerceNumber(record.duration_seconds);
  const communityName = normalizeCommunityName(
    targetScope,
    communityId ?? communityIdSnapshot,
    coerceString(record.community_name_snapshot),
    communities,
  );

  return {
    id,
    classification,
    communityId,
    communityIdSnapshot,
    communityName,
    durationSeconds: duration,
    notes: coerceString(record.notes),
    productKey: FIELD_WORK_PRODUCT_KEY,
    startedAt,
    status,
    stoppedAt,
    targetScope,
    workLocation: location,
  };
}

async function listFieldWorkCommunities() {
  const communitiesResult = await getCommunitiesWithProgressResult();
  const communities = communitiesResult.items
    .map((community) => ({
      id: community.id,
      name: community.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    communities,
    error: communitiesResult.error,
  };
}

async function loadAllFieldWorkSessionsForMonth(input: {
  staffUserId: string;
  startIso: string;
  endIso: string;
  communities: FieldWorkCommunityOption[];
}) {
  const supabase = await createClient();
  const sessions: FieldWorkSession[] = [];
  let error: string | null = null;
  let from = 0;

  while (true) {
    const { data, error: pageError } = await supabase
      .from("entry_field_work_sessions")
      .select(fieldWorkSessionSelect)
      .eq("staff_user_id", input.staffUserId)
      .gte("started_at", input.startIso)
      .lt("started_at", input.endIso)
      .order("started_at", { ascending: false })
      .range(from, from + FIELD_WORK_MONTH_PAGE_SIZE - 1);

    if (pageError) {
      error = pageError.message;
      break;
    }

    const page = Array.isArray(data) ? data : [];
    sessions.push(
      ...page
        .map((session) => mapWorkSession(session, input.communities))
        .filter((session): session is FieldWorkSession => session !== null),
    );

    if (page.length < FIELD_WORK_MONTH_PAGE_SIZE) {
      break;
    }

    from += FIELD_WORK_MONTH_PAGE_SIZE;
  }

  return { error, sessions };
}

export function buildFieldWorkCopySummary(input: {
  staffEmail: string;
  summary: FieldWorkMonthlySummary;
}) {
  const lines = [
    `${FIELD_WORK_PRODUCT_KEY} - ${input.summary.monthLabel}`,
    "",
    `Staff: ${input.staffEmail}`,
    `Operating timezone: ${FIELD_WORK_OPERATING_TIME_ZONE}`,
    `Total: ${formatFieldWorkDuration(input.summary.totalSeconds)}`,
    `Completed sessions: ${input.summary.completedSessions}`,
  ];

  if (input.summary.byTarget.length === 0) {
    lines.push("", "No completed sessions in this month.");
    return lines.join("\n");
  }

  for (const target of input.summary.byTarget) {
    lines.push("", target.label);

    for (const item of target.lines) {
      lines.push(`${item.label}: ${formatFieldWorkDuration(item.seconds)}`);
    }

    lines.push(`Total: ${formatFieldWorkDuration(target.seconds)}`);
  }

  return lines.join("\n");
}

export function buildFieldWorkSessionHistoryLines(sessions: FieldWorkSession[]) {
  return sessions.map((session) => {
    const timeRange = `${formatSessionTime(session.startedAt)}-${
      session.stoppedAt ? formatSessionTime(session.stoppedAt) : "active"
    }`;
    const status =
      session.status === "CANCELLED"
        ? "Cancelled"
        : session.status === "ACTIVE"
          ? "Active"
          : "Completed";
    const duration = isCompletedFieldWorkSession(session)
      ? formatFieldWorkDuration(session.durationSeconds)
      : status;
    const notes = session.notes ? ` - ${session.notes}` : "";

    return [
      formatSessionDate(session.startedAt),
      timeRange,
      getFieldWorkTargetLabel(session),
      getFieldWorkClassificationLabel(session.classification),
      getFieldWorkLocationLabel(session.workLocation),
      duration,
    ].join(" | ") + notes;
  });
}

export async function getFieldActiveWorkTimer(
  staffUserId: string,
): Promise<FieldActiveWorkTimer | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entry_field_work_sessions")
    .select(fieldWorkSessionSelect)
    .eq("staff_user_id", staffUserId)
    .eq("status", "ACTIVE")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const session = data ? mapWorkSession(data, []) : null;
  if (!session || session.status !== "ACTIVE") {
    return null;
  }

  return {
    classification: session.classification,
    communityName: session.communityName,
    id: session.id,
    startedAt: session.startedAt,
    targetScope: session.targetScope,
    workLocation: session.workLocation,
  };
}

export async function getFieldWorkTimerPageData(
  staffUser: FieldWorkStaffUser,
  requestedMonth?: string,
): Promise<FieldWorkTimerPageData> {
  const month = normalizeFieldOperatingMonth(requestedMonth);
  const monthLabel = formatFieldOperatingMonthLabel(month);
  const { startIso, endIso } = getFieldOperatingMonthRange(month);
  const { communities, error: communitiesError } = await listFieldWorkCommunities();
  const [activeSession, monthlyResult] = await Promise.all([
    getFieldActiveWorkTimer(staffUser.id),
    loadAllFieldWorkSessionsForMonth({
      communities,
      endIso,
      staffUserId: staffUser.id,
      startIso,
    }),
  ]);
  const summary = summarizeFieldWorkMonth(monthlyResult.sessions, monthLabel);
  const sessions = monthlyResult.sessions.slice(0, FIELD_WORK_HISTORY_LIMIT);
  const staffEmail = staffUser.email ?? "Authenticated Field staff";

  return {
    activeSession,
    communities,
    copySummary: buildFieldWorkCopySummary({ staffEmail, summary }),
    error: monthlyResult.error ?? communitiesError ?? null,
    historyLimit: FIELD_WORK_HISTORY_LIMIT,
    historyTruncated: monthlyResult.sessions.length > FIELD_WORK_HISTORY_LIMIT,
    month,
    nextMonth: shiftFieldOperatingMonth(month, 1),
    operatingTimeZone: FIELD_WORK_OPERATING_TIME_ZONE,
    previousMonth: shiftFieldOperatingMonth(month, -1),
    sessions,
    staffEmail,
    summary,
    summarySessionCount: monthlyResult.sessions.length,
  };
}
