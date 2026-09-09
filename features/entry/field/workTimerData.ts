import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getCommunitiesWithProgressResult } from "@/features/entry/communities/queries";
import {
  formatFieldWorkDuration,
  getFieldWorkClassificationLabel,
  getFieldWorkLocationLabel,
  isFieldWorkClassification,
  isFieldWorkLocation,
  summarizeFieldWorkMonth,
  type FieldWorkCommunityOption,
  type FieldWorkMonthlySummary,
  type FieldWorkSession,
} from "@/features/entry/field/workTimerModel";
import { createClient } from "@/lib/supabase/server";
import { coerceNumber, coerceString } from "@/lib/supabase/utils";

export type FieldWorkTimerPageData = {
  activeSession: FieldWorkSession | null;
  communities: FieldWorkCommunityOption[];
  copySummary: string;
  error: string | null;
  month: string;
  nextMonth: string;
  previousMonth: string;
  sessions: FieldWorkSession[];
  staffEmail: string;
  summary: FieldWorkMonthlySummary;
};

function normalizeMonth(value: string | undefined) {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    return value;
  }

  return new Date().toISOString().slice(0, 7);
}

function shiftMonth(month: string, offset: number) {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

function getMonthRange(month: string) {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  return {
    endIso: end.toISOString(),
    startIso: start.toISOString(),
  };
}

function formatMonthLabel(month: string) {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function formatSessionDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function formatSessionTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function normalizeCommunityName(
  communityId: string | null,
  snapshot: string,
  communities: FieldWorkCommunityOption[],
) {
  if (!communityId) {
    return "ENTRY general";
  }

  return (
    snapshot ||
    communities.find((community) => community.id === communityId)?.name ||
    "Unknown community"
  );
}

function mapWorkSession(
  item: unknown,
  communities: FieldWorkCommunityOption[],
): FieldWorkSession | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const id = coerceString(record.id);
  const classification = coerceString(record.classification);
  const location = coerceString(record.work_location);
  const startedAt = coerceString(record.started_at);

  if (
    !id ||
    !isFieldWorkClassification(classification) ||
    !isFieldWorkLocation(location) ||
    !startedAt
  ) {
    return null;
  }

  const communityId = coerceString(record.community_id) || null;
  const stoppedAt = coerceString(record.stopped_at) || null;
  const duration =
    record.duration_seconds === null || record.duration_seconds === undefined
      ? null
      : coerceNumber(record.duration_seconds);

  return {
    id,
    classification,
    communityId,
    communityName: normalizeCommunityName(
      communityId,
      coerceString(record.community_name_snapshot),
      communities,
    ),
    durationSeconds: duration,
    notes: coerceString(record.notes),
    startedAt,
    stoppedAt,
    workLocation: location,
  };
}

function buildCopySummary(input: {
  sessions: FieldWorkSession[];
  staffEmail: string;
  summary: FieldWorkMonthlySummary;
}) {
  const lines = [
    "Minerva Field work summary",
    `Staff: ${input.staffEmail}`,
    `Month: ${input.summary.monthLabel}`,
    `Total: ${formatFieldWorkDuration(input.summary.totalSeconds)}`,
    `Completed sessions: ${input.summary.completedSessions}`,
    "",
    "By classification:",
    ...input.summary.byClassification.map(
      (item) => `- ${item.label}: ${formatFieldWorkDuration(item.seconds)}`,
    ),
    "",
    "By location:",
    ...input.summary.byLocation.map(
      (item) => `- ${item.label}: ${formatFieldWorkDuration(item.seconds)}`,
    ),
    "",
    "By community:",
    ...input.summary.byCommunity.map(
      (item) => `- ${item.label}: ${formatFieldWorkDuration(item.seconds)}`,
    ),
    "",
    "Sessions:",
    ...input.sessions
      .filter((session) => session.stoppedAt && session.durationSeconds !== null)
      .map((session) => {
        const timeRange = `${formatSessionTime(session.startedAt)}-${formatSessionTime(session.stoppedAt ?? session.startedAt)}`;
        const notes = session.notes ? ` · ${session.notes}` : "";
        return [
          "-",
          formatSessionDate(session.startedAt),
          timeRange,
          getFieldWorkClassificationLabel(session.classification),
          getFieldWorkLocationLabel(session.workLocation),
          session.communityName,
        ].join(" ") + notes;
      }),
  ];

  if (input.summary.completedSessions === 0) {
    lines.push("- No completed sessions in this month.");
  }

  return lines.join("\n");
}

export async function getFieldWorkTimerPageData(
  requestedMonth?: string,
): Promise<FieldWorkTimerPageData> {
  const { user } = await requireSuperadmin();
  const month = normalizeMonth(requestedMonth);
  const monthLabel = formatMonthLabel(month);
  const { startIso, endIso } = getMonthRange(month);
  const communitiesResult = await getCommunitiesWithProgressResult();
  const communities = communitiesResult.items
    .map((community) => ({
      id: community.id,
      name: community.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const supabase = await createClient();
  const [activeResult, sessionsResult] = await Promise.all([
    supabase
      .from("entry_field_work_sessions")
      .select(
        "id,community_id,community_name_snapshot,classification,work_location,notes,started_at,stopped_at,duration_seconds",
      )
      .eq("staff_user_id", user.id)
      .is("stopped_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("entry_field_work_sessions")
      .select(
        "id,community_id,community_name_snapshot,classification,work_location,notes,started_at,stopped_at,duration_seconds",
      )
      .eq("staff_user_id", user.id)
      .gte("started_at", startIso)
      .lt("started_at", endIso)
      .order("started_at", { ascending: false })
      .limit(100),
  ]);

  const sessions = Array.isArray(sessionsResult.data)
    ? sessionsResult.data
        .map((session) => mapWorkSession(session, communities))
        .filter((session): session is FieldWorkSession => session !== null)
    : [];
  const activeSession = activeResult.data
    ? mapWorkSession(activeResult.data, communities)
    : null;
  const summary = summarizeFieldWorkMonth(sessions, monthLabel);
  const staffEmail = user.email ?? "Authenticated Field staff";
  const error =
    activeResult.error?.message ??
    sessionsResult.error?.message ??
    communitiesResult.error ??
    null;

  return {
    activeSession,
    communities,
    copySummary: buildCopySummary({ sessions, staffEmail, summary }),
    error,
    month,
    nextMonth: shiftMonth(month, 1),
    previousMonth: shiftMonth(month, -1),
    sessions,
    staffEmail,
    summary,
  };
}
