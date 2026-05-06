"use client";

import { useEffect, useMemo, useState } from "react";
import type { CommunityAdminActivityPreview } from "@/features/entry/communities/activityQueries";

type ActivityFilter =
  | "all"
  | "users"
  | "messages"
  | "reservations"
  | "activation";

type CommunityAdminActivityDrawerProps = {
  activities: CommunityAdminActivityPreview[];
  triggerLabel?: string;
};

const filters: Array<{ label: string; value: ActivityFilter }> = [
  { label: "All", value: "all" },
  { label: "Users", value: "users" },
  { label: "Messages", value: "messages" },
  { label: "Reservations", value: "reservations" },
  { label: "Activation", value: "activation" },
];

function getActivityIcon(actionType: string) {
  if (actionType.includes("message")) {
    return "✉";
  }

  if (actionType.includes("reservation") || actionType.includes("facility")) {
    return "▤";
  }

  if (actionType.includes("activation") || actionType.includes("password")) {
    return "◴";
  }

  if (actionType.includes("resident") || actionType.includes("user")) {
    return "◎";
  }

  return "•";
}

function getActivityTone(actionType: string) {
  if (actionType.includes("rejected") || actionType.includes("cancelled")) {
    return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  }

  if (actionType.includes("approved") || actionType.includes("sent")) {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  }

  if (actionType.includes("activation") || actionType.includes("password")) {
    return "border-violet-300/25 bg-violet-400/12 text-violet-100";
  }

  return "border-white/10 bg-white/7 text-[var(--text-muted)]";
}

function getActivityGroup(actionType: string): ActivityFilter {
  if (actionType.includes("message")) {
    return "messages";
  }

  if (actionType.includes("reservation") || actionType.includes("facility")) {
    return "reservations";
  }

  if (actionType.includes("activation") || actionType.includes("password")) {
    return "activation";
  }

  if (actionType.includes("resident") || actionType.includes("user")) {
    return "users";
  }

  return "all";
}

function formatMetadataValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return "Available";
}

function ActivityBadge({ actionType }: { actionType: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getActivityTone(
        actionType,
      )}`}
    >
      {actionType.replaceAll("_", " ")}
    </span>
  );
}

export function CommunityAdminActivityDrawer({
  activities,
  triggerLabel = "View full log",
}: CommunityAdminActivityDrawerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    activities[0]?.id ?? null,
  );

  const filteredActivities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return activities.filter((activity) => {
      const matchesQuery =
        !normalizedQuery ||
        activity.summary.toLowerCase().includes(normalizedQuery) ||
        activity.actorName.toLowerCase().includes(normalizedQuery) ||
        activity.actionType.toLowerCase().includes(normalizedQuery) ||
        activity.targetType.toLowerCase().includes(normalizedQuery);

      if (!matchesQuery) {
        return false;
      }

      if (filter === "all") {
        return true;
      }

      return getActivityGroup(activity.actionType) === filter;
    });
  }, [activities, filter, query]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (filteredActivities.length === 0) {
      setSelectedId(null);
      return;
    }

    if (
      !selectedId ||
      !filteredActivities.some((activity) => activity.id === selectedId)
    ) {
      setSelectedId(filteredActivities[0]?.id ?? null);
    }
  }, [filteredActivities, open, selectedId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const selectedActivity =
    filteredActivities.find((activity) => activity.id === selectedId) ??
    filteredActivities[0] ??
    null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-semibold text-violet-200 transition hover:text-white"
      >
        {triggerLabel} →
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <button
            type="button"
            aria-label="Close admin activity log"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-4xl flex-col border-l border-white/10 bg-[rgba(7,11,22,0.98)] shadow-[-28px_0_80px_rgba(0,0,0,0.4)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                  Entry operations
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Recent Admin Activity
                </h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Review important administrative actions without exposing private message content.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-xl text-[var(--text-muted)] transition hover:border-violet-300/40 hover:text-white"
                aria-label="Close admin activity log"
              >
                ×
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-6 py-5">
              <label className="relative block">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  ⌕
                </span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search activity, actor, or action type..."
                  className="h-12 w-full rounded-2xl border border-white/10 bg-[var(--surface-strong)] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-300/50"
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-2">
                {filters.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFilter(item.value)}
                    className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                      filter === item.value
                        ? "border-violet-300/50 bg-[var(--primary)] text-white shadow-[0_14px_32px_rgba(112,104,255,0.28)]"
                        : "border-white/10 bg-white/5 text-[var(--text-muted)] hover:border-violet-300/40 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="mt-5 min-h-0 flex-1 overflow-hidden rounded-[28px] border border-white/10 bg-[var(--surface)]">
                <div className="grid grid-cols-[minmax(180px,1fr)_140px_180px_120px] border-b border-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  <span>Activity</span>
                  <span>Actor</span>
                  <span>Type</span>
                  <span className="text-right">Time</span>
                </div>

                {filteredActivities.length === 0 ? (
                  <div className="grid h-64 place-items-center px-6 text-center">
                    <div>
                      <p className="text-base font-semibold text-white">
                        No activity matches this view
                      </p>
                      <p className="mt-2 text-sm text-[var(--text-muted)]">
                        Try another filter or clear the search field.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[48vh] overflow-y-auto px-3 py-3">
                    {filteredActivities.map((activity) => {
                      const selected = activity.id === selectedActivity?.id;

                      return (
                        <button
                          key={activity.id}
                          type="button"
                          onClick={() => setSelectedId(activity.id)}
                          className={`grid w-full grid-cols-[minmax(180px,1fr)_140px_180px_120px] items-center rounded-2xl border px-3 py-3 text-left text-sm transition ${
                            selected
                              ? "border-violet-300/50 bg-violet-400/12 shadow-[0_12px_34px_rgba(112,104,255,0.16)]"
                              : "border-transparent hover:border-white/10 hover:bg-white/5"
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-xs text-violet-100">
                              {getActivityIcon(activity.actionType)}
                            </span>
                            <span className="truncate font-semibold text-white">
                              {activity.summary}
                            </span>
                          </span>
                          <span className="truncate text-[var(--text-muted)]">
                            {activity.actorName}
                          </span>
                          <span>
                            <ActivityBadge actionType={activity.actionType} />
                          </span>
                          <span className="text-right text-[var(--text-muted)]">
                            {activity.createdAt}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-white/10 bg-[rgba(9,12,24,0.84)] px-6 py-5">
              {selectedActivity ? (
                <div className="rounded-[28px] border border-white/10 bg-[var(--surface)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--primary)] text-2xl text-white">
                        {getActivityIcon(selectedActivity.actionType)}
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                          Selected activity
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <h3 className="text-2xl font-semibold text-white">
                            {selectedActivity.summary}
                          </h3>
                          <ActivityBadge actionType={selectedActivity.actionType} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-4">
                    {[
                      ["Actor", selectedActivity.actorName],
                      ["Role", selectedActivity.actorRole],
                      ["Target", selectedActivity.targetType.replaceAll("_", " ")],
                      ["Recorded", selectedActivity.createdAt],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-white/8 bg-[var(--surface-strong)] px-4 py-3"
                      >
                        <p className="text-xs text-[var(--text-muted)]">{label}</p>
                        <p className="mt-2 text-sm font-semibold text-white">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Operational context
                    </p>
                    {Object.entries(selectedActivity.metadata).length > 0 ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {Object.entries(selectedActivity.metadata)
                          .filter(([key]) => !key.toLowerCase().includes("message"))
                          .slice(0, 6)
                          .map(([key, value]) => (
                            <div key={key} className="rounded-xl bg-black/12 px-3 py-2">
                              <p className="text-xs text-[var(--text-muted)]">
                                {key.replaceAll("_", " ")}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-white">
                                {formatMetadataValue(value)}
                              </p>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-[var(--text-muted)]">
                        No additional context stored for this activity.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/10 bg-white/3 px-4 py-5 text-sm text-[var(--text-muted)]">
                  Select an activity to see details here.
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
