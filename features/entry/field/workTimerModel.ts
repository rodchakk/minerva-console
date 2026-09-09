export const FIELD_WORK_PRODUCT_KEY = "ENTRY" as const;

export const FIELD_WORK_ACTIVITY_OPTIONS = [
  { value: "ONBOARDING", label: "Onboarding", summaryLabel: "Onboarding" },
  { value: "SUPPORT", label: "Soporte", summaryLabel: "Soporte" },
  {
    value: "PRODUCT_MAINTENANCE",
    label: "Mantenimiento de ENTRY",
    summaryLabel: "Mantenimiento",
  },
  {
    value: "PRODUCT_DEVELOPMENT_RND",
    label: "Desarrollo / R&D",
    summaryLabel: "R&D",
  },
  { value: "OTHER", label: "Otro", summaryLabel: "Otro" },
] as const;

export const FIELD_WORK_MODE_OPTIONS = [
  { value: "ONSITE", label: "Presencial" },
  { value: "REMOTE", label: "Remoto" },
] as const;

export const FIELD_WORK_TARGET_OPTIONS = [
  { value: "CLIENT", label: "Comunidad" },
  { value: "PRODUCT", label: "ENTRY general" },
] as const;

export type FieldWorkActivityCategory =
  (typeof FIELD_WORK_ACTIVITY_OPTIONS)[number]["value"];
export type FieldWorkMode = (typeof FIELD_WORK_MODE_OPTIONS)[number]["value"];
export type FieldWorkTargetScope =
  (typeof FIELD_WORK_TARGET_OPTIONS)[number]["value"];
export type FieldWorkStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

export type FieldWorkSession = {
  activityCategory: FieldWorkActivityCategory;
  communityId: string | null;
  communityNameSnapshot: string | null;
  createdAt: string;
  durationSeconds: number;
  endedAt: string | null;
  id: string;
  note: string | null;
  productKey: typeof FIELD_WORK_PRODUCT_KEY;
  startedAt: string;
  status: FieldWorkStatus;
  targetScope: FieldWorkTargetScope;
  updatedAt: string;
  userId: string;
  workMode: FieldWorkMode;
};

export type FieldWorkCommunityOption = {
  city: string;
  id: string;
  isActive: boolean;
  name: string;
};

export type FieldWorkSummaryLine = {
  activityCategory: FieldWorkActivityCategory;
  activityLabel: string;
  durationSeconds: number;
  workMode: FieldWorkMode;
  workModeLabel: string;
};

export type FieldWorkSummarySection = {
  durationSeconds: number;
  lines: FieldWorkSummaryLine[];
  targetKey: string;
  targetLabel: string;
};

export type FieldWorkMonthlySummary = {
  monthKey: string;
  monthTitle: string;
  sections: FieldWorkSummarySection[];
  totalSeconds: number;
};

const ACTIVITY_LABELS = new Map(
  FIELD_WORK_ACTIVITY_OPTIONS.map((option) => [option.value, option.label]),
);

const ACTIVITY_SUMMARY_LABELS = new Map(
  FIELD_WORK_ACTIVITY_OPTIONS.map((option) => [
    option.value,
    option.summaryLabel,
  ]),
);

const WORK_MODE_LABELS = new Map(
  FIELD_WORK_MODE_OPTIONS.map((option) => [option.value, option.label]),
);

const SPANISH_MONTH_FORMATTER = new Intl.DateTimeFormat("es-HN", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

function capitalize(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

export function isFieldWorkTargetScope(
  value: string,
): value is FieldWorkTargetScope {
  return FIELD_WORK_TARGET_OPTIONS.some((option) => option.value === value);
}

export function isFieldWorkActivityCategory(
  value: string,
): value is FieldWorkActivityCategory {
  return FIELD_WORK_ACTIVITY_OPTIONS.some((option) => option.value === value);
}

export function isFieldWorkMode(value: string): value is FieldWorkMode {
  return FIELD_WORK_MODE_OPTIONS.some((option) => option.value === value);
}

export function getFieldWorkActivityLabel(
  activityCategory: FieldWorkActivityCategory,
) {
  return ACTIVITY_LABELS.get(activityCategory) ?? "Otro";
}

export function getFieldWorkActivitySummaryLabel(
  activityCategory: FieldWorkActivityCategory,
) {
  return ACTIVITY_SUMMARY_LABELS.get(activityCategory) ?? "Otro";
}

export function getFieldWorkModeLabel(workMode: FieldWorkMode) {
  return WORK_MODE_LABELS.get(workMode) ?? "Presencial";
}

export function getFieldWorkTargetLabel(
  session: Pick<
    FieldWorkSession,
    "communityNameSnapshot" | "targetScope"
  >,
) {
  return session.targetScope === "CLIENT"
    ? session.communityNameSnapshot ?? "Comunidad"
    : "ENTRY general";
}

export function formatTimerDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, "0"))
    .join(":");
}

export function formatWorkDuration(totalSeconds: number) {
  const safeMinutes = Math.max(0, Math.round(totalSeconds / 60));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}m`;
}

export function getElapsedSeconds(startedAt: string, now = new Date()) {
  const started = new Date(startedAt).getTime();
  const current = now.getTime();

  if (!Number.isFinite(started) || !Number.isFinite(current)) {
    return 0;
  }

  return Math.max(0, Math.floor((current - started) / 1000));
}

export function getCompletedDurationSeconds(
  startedAt: string,
  endedAt: string | null,
) {
  if (!endedAt) return 0;

  const started = new Date(startedAt).getTime();
  const ended = new Date(endedAt).getTime();

  if (!Number.isFinite(started) || !Number.isFinite(ended)) {
    return 0;
  }

  return Math.max(0, Math.floor((ended - started) / 1000));
}

export function getMonthRange(monthKey?: string) {
  const now = new Date();
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey ?? "");
  const year = match ? Number(match[1]) : now.getFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : now.getMonth();
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0));
  const key = `${start.getUTCFullYear()}-${String(
    start.getUTCMonth() + 1,
  ).padStart(2, "0")}`;

  return {
    endIso: end.toISOString(),
    key,
    startIso: start.toISOString(),
    title: capitalize(SPANISH_MONTH_FORMATTER.format(start).replace(" de ", " ")),
  };
}

export function buildFieldWorkMonthlySummary(
  sessions: FieldWorkSession[],
  monthKey?: string,
): FieldWorkMonthlySummary {
  const month = getMonthRange(monthKey);
  const sectionMap = new Map<string, FieldWorkSummarySection>();

  for (const session of sessions) {
    if (session.status !== "COMPLETED") continue;

    const targetLabel = getFieldWorkTargetLabel(session);
    const targetKey =
      session.targetScope === "CLIENT"
        ? `CLIENT:${session.communityId ?? targetLabel}`
        : "PRODUCT:ENTRY";
    const section =
      sectionMap.get(targetKey) ??
      {
        durationSeconds: 0,
        lines: [],
        targetKey,
        targetLabel,
      };

    const lineKey = `${session.activityCategory}:${session.workMode}`;
    let line = section.lines.find(
      (item) => `${item.activityCategory}:${item.workMode}` === lineKey,
    );

    if (!line) {
      line = {
        activityCategory: session.activityCategory,
        activityLabel: getFieldWorkActivitySummaryLabel(session.activityCategory),
        durationSeconds: 0,
        workMode: session.workMode,
        workModeLabel: getFieldWorkModeLabel(session.workMode),
      };
      section.lines.push(line);
    }

    line.durationSeconds += session.durationSeconds;
    section.durationSeconds += session.durationSeconds;
    sectionMap.set(targetKey, section);
  }

  const sections = Array.from(sectionMap.values())
    .map((section) => ({
      ...section,
      lines: section.lines.sort((first, second) =>
        first.activityLabel.localeCompare(second.activityLabel),
      ),
    }))
    .sort((first, second) => {
      if (first.targetKey === "PRODUCT:ENTRY") return 1;
      if (second.targetKey === "PRODUCT:ENTRY") return -1;
      return first.targetLabel.localeCompare(second.targetLabel);
    });

  return {
    monthKey: month.key,
    monthTitle: month.title,
    sections,
    totalSeconds: sections.reduce(
      (total, section) => total + section.durationSeconds,
      0,
    ),
  };
}

export function buildFieldWorkSummaryText(summary: FieldWorkMonthlySummary) {
  const lines = [`ENTRY - ${summary.monthTitle}`, ""];

  for (const section of summary.sections) {
    lines.push(section.targetLabel);

    const activityCounts = new Map<string, number>();
    for (const line of section.lines) {
      activityCounts.set(
        line.activityCategory,
        (activityCounts.get(line.activityCategory) ?? 0) + 1,
      );
    }

    for (const line of section.lines) {
      const label =
        (activityCounts.get(line.activityCategory) ?? 0) > 1
          ? `${line.activityLabel} (${line.workModeLabel})`
          : line.activityLabel;
      lines.push(`${label}: ${formatWorkDuration(line.durationSeconds)}`);
    }

    lines.push(`Total: ${formatWorkDuration(section.durationSeconds)}`);
    lines.push("");
  }

  if (summary.sections.length === 0) {
    lines.push("Sin trabajo registrado.");
    lines.push("");
  }

  lines.push(`Total ENTRY: ${formatWorkDuration(summary.totalSeconds)}`);

  return lines.join("\n");
}
