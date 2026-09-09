export type FieldWorkClassification =
  | "onboarding"
  | "support"
  | "maintenance"
  | "research_development";

export type FieldWorkLocation = "onsite" | "remote";

export type FieldWorkCommunityOption = {
  id: string;
  name: string;
};

export type FieldWorkSession = {
  id: string;
  classification: FieldWorkClassification;
  communityId: string | null;
  communityName: string;
  durationSeconds: number | null;
  notes: string;
  startedAt: string;
  stoppedAt: string | null;
  workLocation: FieldWorkLocation;
};

export type FieldWorkSummaryLine = {
  id: string;
  label: string;
  seconds: number;
};

export type FieldWorkMonthlySummary = {
  byClassification: FieldWorkSummaryLine[];
  byCommunity: FieldWorkSummaryLine[];
  byLocation: FieldWorkSummaryLine[];
  completedSessions: number;
  monthLabel: string;
  totalSeconds: number;
};

export const FIELD_WORK_CLASSIFICATIONS = [
  { id: "onboarding", label: "Onboarding" },
  { id: "support", label: "Support" },
  { id: "maintenance", label: "Maintenance" },
  { id: "research_development", label: "R&D" },
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

export function getFieldWorkClassificationLabel(
  value: FieldWorkClassification,
) {
  return (
    FIELD_WORK_CLASSIFICATIONS.find((item) => item.id === value)?.label ??
    "Onboarding"
  );
}

export function getFieldWorkLocationLabel(value: FieldWorkLocation) {
  return FIELD_WORK_LOCATIONS.find((item) => item.id === value)?.label ?? "Onsite";
}

export function isFieldWorkClassification(
  value: string,
): value is FieldWorkClassification {
  return FIELD_WORK_CLASSIFICATIONS.some((item) => item.id === value);
}

export function isFieldWorkLocation(value: string): value is FieldWorkLocation {
  return FIELD_WORK_LOCATIONS.some((item) => item.id === value);
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

export function getFieldWorkElapsedSeconds(session: FieldWorkSession) {
  if (session.durationSeconds !== null) {
    return session.durationSeconds;
  }

  const startedAt = new Date(session.startedAt).getTime();
  if (!Number.isFinite(startedAt)) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
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

export function summarizeFieldWorkMonth(
  sessions: FieldWorkSession[],
  monthLabel: string,
): FieldWorkMonthlySummary {
  const byClassification = new Map<string, FieldWorkSummaryLine>();
  const byCommunity = new Map<string, FieldWorkSummaryLine>();
  const byLocation = new Map<string, FieldWorkSummaryLine>();
  let completedSessions = 0;
  let totalSeconds = 0;

  for (const session of sessions) {
    if (!session.stoppedAt || session.durationSeconds === null) {
      continue;
    }

    completedSessions += 1;
    totalSeconds += session.durationSeconds;
    addSeconds(
      byClassification,
      session.classification,
      getFieldWorkClassificationLabel(session.classification),
      session.durationSeconds,
    );
    addSeconds(
      byLocation,
      session.workLocation,
      getFieldWorkLocationLabel(session.workLocation),
      session.durationSeconds,
    );
    addSeconds(
      byCommunity,
      session.communityId ?? "entry-general",
      session.communityName,
      session.durationSeconds,
    );
  }

  const sortLines = (lines: FieldWorkSummaryLine[]) =>
    lines.sort((a, b) => b.seconds - a.seconds || a.label.localeCompare(b.label));

  return {
    byClassification: sortLines(Array.from(byClassification.values())),
    byCommunity: sortLines(Array.from(byCommunity.values())),
    byLocation: sortLines(Array.from(byLocation.values())),
    completedSessions,
    monthLabel,
    totalSeconds,
  };
}
