export type FieldRegistrationProgressFilter =
  | "all"
  | "not_registered"
  | "submitted"
  | "needs_attention"
  | "reviewed"
  | "completed";

export type FieldRegistrationProgressGroup =
  | Exclude<FieldRegistrationProgressFilter, "all">
  | "other";

export type FieldRegistrationProgressUnit = {
  id: string;
  label: string;
  status: string;
};

export type FieldRegistrationProgressCampaign = {
  id: string;
  publicTitle: string;
  status: string;
};

export type FieldRegistrationProgressState =
  | {
      state: "ready";
      campaign: FieldRegistrationProgressCampaign | null;
      units: FieldRegistrationProgressUnit[];
    }
  | {
      state: "unavailable";
      campaign: null;
      units: FieldRegistrationProgressUnit[];
    };

export const FIELD_REGISTRATION_PROGRESS_FILTERS = [
  { id: "all", label: "All" },
  { id: "not_registered", label: "Not registered" },
  { id: "submitted", label: "Submitted" },
  { id: "needs_attention", label: "Needs attention" },
  { id: "reviewed", label: "Reviewed" },
  { id: "completed", label: "Completed" },
] as const satisfies ReadonlyArray<{
  id: FieldRegistrationProgressFilter;
  label: string;
}>;

export function normalizeRegistrationUnitStatus(status: string) {
  return status.trim().toLowerCase();
}

export function createUnavailableRegistrationProgressState(): FieldRegistrationProgressState {
  return {
    campaign: null,
    state: "unavailable",
    units: [],
  };
}

export function createReadyRegistrationProgressState(
  campaign: FieldRegistrationProgressCampaign | null,
  units: FieldRegistrationProgressUnit[],
): FieldRegistrationProgressState {
  return {
    campaign,
    state: "ready",
    units,
  };
}

export function getRegistrationProgressStatusGroup(
  status: string,
): FieldRegistrationProgressGroup {
  const normalized = normalizeRegistrationUnitStatus(status);

  switch (normalized) {
    case "unregistered":
      return "not_registered";
    case "submitted":
      return "submitted";
    case "edit_enabled":
    case "needs_correction":
      return "needs_attention";
    case "reviewed":
      return "reviewed";
    case "confirmed":
    case "processed":
      return "completed";
    default:
      return "other";
  }
}

export function getRegistrationProgressStatusLabel(status: string) {
  const normalized = normalizeRegistrationUnitStatus(status);

  switch (normalized) {
    case "unregistered":
      return "Not registered";
    case "submitted":
      return "Submitted";
    case "edit_enabled":
      return "Edit enabled";
    case "needs_correction":
      return "Needs attention";
    case "reviewed":
      return "Reviewed";
    case "confirmed":
      return "Confirmed";
    case "processed":
      return "Processed";
    default:
      return normalized
        ? normalized.replaceAll("_", " ")
        : "Unknown status";
  }
}

export function getRegistrationProgressStatusTone(status: string) {
  switch (getRegistrationProgressStatusGroup(status)) {
    case "submitted":
      return "border-sky-300/30 bg-sky-300/10 text-sky-100";
    case "needs_attention":
      return "border-amber-300/30 bg-amber-300/10 text-amber-100";
    case "reviewed":
      return "border-violet-300/30 bg-violet-300/10 text-violet-100";
    case "completed":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
    case "not_registered":
    case "other":
    default:
      return "border-white/12 bg-white/[0.03] text-[var(--console-text-muted)]";
  }
}

export function filterRegistrationProgressUnits({
  filter,
  query,
  units,
}: {
  filter: FieldRegistrationProgressFilter;
  query: string;
  units: FieldRegistrationProgressUnit[];
}) {
  const normalizedQuery = query.trim().toLowerCase();

  return units.filter((unit) => {
    const matchesQuery =
      !normalizedQuery || unit.label.toLowerCase().includes(normalizedQuery);
    const matchesFilter =
      filter === "all" || getRegistrationProgressStatusGroup(unit.status) === filter;

    return matchesQuery && matchesFilter;
  });
}

export function getRegistrationProgressCounts(
  units: FieldRegistrationProgressUnit[],
) {
  return units.reduce(
    (counts, unit) => {
      const group = getRegistrationProgressStatusGroup(unit.status);

      if (group !== "not_registered") {
        counts.submitted += 1;
      }

      if (group === "not_registered") {
        counts.notRegistered += 1;
      }

      if (group === "needs_attention") {
        counts.needsAttention += 1;
      }

      return counts;
    },
    {
      needsAttention: 0,
      notRegistered: 0,
      submitted: 0,
      total: units.length,
    },
  );
}
