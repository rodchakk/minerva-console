export const FIELD_WORK_PRODUCT_KEY = "ENTRY" as const;
export const FIELD_WORK_OPERATING_TIME_ZONE = "America/Tegucigalpa" as const;

const HONDURAS_UTC_OFFSET_HOURS = 6;

export type FieldWorkTargetScope = "PRODUCT" | "CLIENT";

export type FieldWorkClassification =
  | "ONBOARDING"
  | "SUPPORT"
  | "PRODUCT_MAINTENANCE"
  | "PRODUCT_DEVELOPMENT_RND"
  | "OTHER";

export type FieldWorkLocation = "onsite" | "remote";

export type FieldWorkSessionStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

export type FieldWorkCommunityOption = {
  id: string;
  name: string;
};

export type FieldWorkSession = {
  id: string;
  classification: FieldWorkClassification;
  communityId: string | null;
  communityIdSnapshot: string | null;
  communityName: string;
  durationSeconds: number | null;
  notes: string;
  productKey: typeof FIELD_WORK_PRODUCT_KEY;
  startedAt: string;
  status: FieldWorkSessionStatus;
  stoppedAt: string | null;
  targetScope: FieldWorkTargetScope;
  workLocation: FieldWorkLocation;
};

export type FieldActiveWorkTimer = Pick<
  FieldWorkSession,
  | "classification"
  | "communityName"
  | "id"
  | "startedAt"
  | "targetScope"
  | "workLocation"
>;

export type FieldWorkSummaryLine = {
  id: string;
  label: string;
  seconds: number;
};

export type FieldWorkTargetCategoryLine = FieldWorkSummaryLine & {
  classification: FieldWorkClassification;
};

export type FieldWorkTargetSummary = {
  id: string;
  label: string;
  lines: FieldWorkTargetCategoryLine[];
  seconds: number;
  targetScope: FieldWorkTargetScope;
};

export type FieldWorkMonthlySummary = {
  byClassification: FieldWorkSummaryLine[];
  byLocation: FieldWorkSummaryLine[];
  byTarget: FieldWorkTargetSummary[];
  completedSessions: number;
  monthLabel: string;
  totalSeconds: number;
};

export const FIELD_WORK_TARGET_SCOPES = [
  { id: "PRODUCT", label: "ENTRY general" },
  { id: "CLIENT", label: "Client community" },
] as const satisfies ReadonlyArray<{
  id: FieldWorkTargetScope;
  label: string;
}>;

export const FIELD_WORK_CLASSIFICATIONS = [
  { id: "ONBOARDING", label: "Onboarding" },
  { id: "SUPPORT", label: "Support" },
  { id: "PRODUCT_MAINTENANCE", label: "Maintenance" },
  { id: "PRODUCT_DEVELOPMENT_RND", label: "R&D" },
  { id: "OTHER", label: "Other" },
] as const satisfies ReadonlyArray<{
  id: FieldWorkClassification;
  label: string;
}>;

export const FIELD_WORK_LOCATIONS = [
  { id: "onsite", label: "Onsite" },
  { id: "remote", label: "Remote" },
] as const satisfies ReadonlyArray<{
  id: FieldWorkLocation;
  label: string;
}>;

export function getFieldWorkTargetScopeLabel(value: FieldWorkTargetScope) {
  return (
    FIELD_WORK_TARGET_SCOPES.find((item) => item.id === value)?.label ??
    "ENTRY general"
  );
}

export function getFieldWorkClassificationLabel(
  value: FieldWorkClassification,
) {
  return (
    FIELD_WORK_CLASSIFICATIONS.find((item) => item.id === value)?.label ??
    "Other"
  );
}

export function getFieldWorkLocationLabel(value: FieldWorkLocation) {
  return FIELD_WORK_LOCATIONS.find((item) => item.id === value)?.label ?? "Onsite";
}

export function isFieldWorkTargetScope(
  value: string,
): value is FieldWorkTargetScope {
  return FIELD_WORK_TARGET_SCOPES.some((item) => item.id === value);
}

export function isFieldWorkClassification(
  value: string,
): value is FieldWorkClassification {
  return FIELD_WORK_CLASSIFICATIONS.some((item) => item.id === value);
}

export function isFieldWorkLocation(value: string): value is FieldWorkLocation {
  return FIELD_WORK_LOCATIONS.some((item) => item.id === value);
}

export function isFieldWorkSessionStatus(
  value: string,
): value is FieldWorkSessionStatus {
  return value === "ACTIVE" || value === "COMPLETED" || value === "CANCELLED";
}

export function formatFieldWorkDuration(totalSeconds: number | null) {
  const seconds = Math.max(0, Math.floor(totalSeconds ?? 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours <= 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

export function formatFieldWorkClock(totalSeconds: number | null) {
  const seconds = Math.max(0, Math.floor(totalSeconds ?? 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return [
    hours.toString().padStart(2, "0"),
    minutes.toString().padStart(2, "0"),
    remainingSeconds.toString().padStart(2, "0"),
  ].join(":");
}

export function getFieldWorkElapsedSeconds(session: FieldWorkSession) {
  if (session.status === "COMPLETED" && session.durationSeconds !== null) {
    return session.durationSeconds;
  }

  const startedAt = new Date(session.startedAt).getTime();
  if (!Number.isFinite(startedAt)) {
    return 0;
  }

  const stoppedAt = session.stoppedAt
    ? new Date(session.stoppedAt).getTime()
    : Date.now();

  if (!Number.isFinite(stoppedAt)) {
    return 0;
  }

  return Math.max(0, Math.floor((stoppedAt - startedAt) / 1000));
}

export function getFieldOperatingMonth(date: Date) {
  const hondurasDate = new Date(
    date.getTime() - HONDURAS_UTC_OFFSET_HOURS * 60 * 60 * 1000,
  );
  return hondurasDate.toISOString().slice(0, 7);
}

export function normalizeFieldOperatingMonth(value: string | undefined) {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    return value;
  }

  return getFieldOperatingMonth(new Date());
}

export function shiftFieldOperatingMonth(month: string, offset: number) {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export function getFieldOperatingMonthRange(month: string) {
  const nextMonth = shiftFieldOperatingMonth(month, 1);

  return {
    endIso: `${nextMonth}-01T06:00:00.000Z`,
    startIso: `${month}-01T06:00:00.000Z`,
  };
}

export function formatFieldOperatingMonthLabel(month: string) {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

export function isCompletedFieldWorkSession(session: FieldWorkSession) {
  return (
    session.status === "COMPLETED" &&
    !!session.stoppedAt &&
    session.durationSeconds !== null
  );
}

function addSeconds(
  lines: Map<string, FieldWorkSummaryLine>,
  id: string,
  label: string,
  seconds: number,
) {
  const current = lines.get(id);
  lines.set(id, {
    id,
    label,
    seconds: (current?.seconds ?? 0) + seconds,
  });
}

function getTargetGroupId(session: FieldWorkSession) {
  if (session.targetScope === "CLIENT") {
    return `CLIENT:${session.communityIdSnapshot ?? session.communityName}`;
  }

  return "PRODUCT:ENTRY";
}

export function getFieldWorkTargetLabel(
  session: Pick<FieldWorkSession, "communityName" | "targetScope">,
) {
  return session.targetScope === "CLIENT"
    ? session.communityName || "Unknown client"
    : "ENTRY general";
}

export function summarizeFieldWorkMonth(
  sessions: FieldWorkSession[],
  monthLabel: string,
): FieldWorkMonthlySummary {
  const byClassification = new Map<string, FieldWorkSummaryLine>();
  const byLocation = new Map<string, FieldWorkSummaryLine>();
  const targetGroups = new Map<
    string,
    {
      label: string;
      lines: Map<string, FieldWorkTargetCategoryLine>;
      seconds: number;
      targetScope: FieldWorkTargetScope;
    }
  >();
  let completedSessions = 0;
  let totalSeconds = 0;

  for (const session of sessions) {
    if (!isCompletedFieldWorkSession(session)) {
      continue;
    }

    const seconds = session.durationSeconds ?? 0;
    completedSessions += 1;
    totalSeconds += seconds;
    addSeconds(
      byClassification,
      session.classification,
      getFieldWorkClassificationLabel(session.classification),
      seconds,
    );
    addSeconds(
      byLocation,
      session.workLocation,
      getFieldWorkLocationLabel(session.workLocation),
      seconds,
    );

    const targetId = getTargetGroupId(session);
    const targetLabel = getFieldWorkTargetLabel(session);
    const targetGroup =
      targetGroups.get(targetId) ??
      {
        label: targetLabel,
        lines: new Map<string, FieldWorkTargetCategoryLine>(),
        seconds: 0,
        targetScope: session.targetScope,
      };
    const line = targetGroup.lines.get(session.classification);
    targetGroup.lines.set(session.classification, {
      classification: session.classification,
      id: session.classification,
      label: getFieldWorkClassificationLabel(session.classification),
      seconds: (line?.seconds ?? 0) + seconds,
    });
    targetGroup.seconds += seconds;
    targetGroups.set(targetId, targetGroup);
  }

  const sortLines = <T extends FieldWorkSummaryLine>(lines: T[]) =>
    lines.sort((a, b) => b.seconds - a.seconds || a.label.localeCompare(b.label));

  const byTarget = Array.from(targetGroups.entries())
    .map(([id, group]) => ({
      id,
      label: group.label,
      lines: sortLines(Array.from(group.lines.values())),
      seconds: group.seconds,
      targetScope: group.targetScope,
    }))
    .sort((a, b) => b.seconds - a.seconds || a.label.localeCompare(b.label));

  return {
    byClassification: sortLines(Array.from(byClassification.values())),
    byLocation: sortLines(Array.from(byLocation.values())),
    byTarget,
    completedSessions,
    monthLabel,
    totalSeconds,
  };
}
