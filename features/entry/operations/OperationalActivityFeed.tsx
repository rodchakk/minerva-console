"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  EntryOperationalActivityItem,
  EntryOperationalActivityResult,
} from "@/features/entry/operations/queries";

type OperationalActivityFeedProps = {
  initialResult: EntryOperationalActivityResult;
  limit?: number;
};

const REFRESH_INTERVAL_MS = 30_000;

function getEventTextStyle(activity: EntryOperationalActivityItem) {
  if (activity.severity === "error") {
    return "font-medium text-red-400";
  }

  if (activity.severity === "warning") {
    return "font-medium text-amber-300";
  }

  return "font-medium text-white";
}

function formatRelativeTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));

  if (seconds < 60) {
    return "Now";
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function OperationalActivityFeed({
  initialResult,
  limit = 8,
}: OperationalActivityFeedProps) {
  const [result, setResult] = useState(initialResult);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      if (document.visibilityState === "hidden") {
        return;
      }

      setRefreshing(true);

      try {
        const response = await fetch("/api/entry/operational-activity?limit=" + limit, {
          cache: "no-store",
          credentials: "same-origin",
        });

        if (!response.ok) {
          throw new Error("Activity refresh failed");
        }

        const nextResult = (await response.json()) as EntryOperationalActivityResult;

        if (!cancelled) {
          setResult(nextResult);
        }
      } catch {
        // Keep the last known-good feed visible when a background refresh fails.
      } finally {
        if (!cancelled) {
          setRefreshing(false);
        }
      }
    }

    const timer = window.setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [limit]);

  return (
    <div>
      <div className="flex items-center justify-end gap-2 border-b border-[#141119] px-5 py-2 text-xs text-[#8F879D]">
        {result.state === "unavailable" ? (
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        ) : null}
        <span>{refreshing ? "Refreshing activity" : "Auto-refreshes every 30s"}</span>
      </div>

      <div className="overflow-x-auto">
        <div>
          <table className="min-w-[880px] w-full text-left text-xs">
            <thead className="border-b border-[#141119] bg-[#1F1B26] text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8F879D]">
              <tr>
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Community</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Detail</th>
                <th className="px-5 py-3 font-medium">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141119]">
              {result.state === "unavailable" ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center">
                    <p className="font-medium text-white">Activity temporarily unavailable</p>
                    <p className="mt-1 text-xs text-[#8F879D]">
                      Operational data could not be loaded safely. The feed will retry automatically.
                    </p>
                  </td>
                </tr>
              ) : result.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center">
                    <p className="font-medium text-white">No operational activity yet</p>
                    <p className="mt-1 text-xs text-[#8F879D]">
                      Important ENTRY actions will appear here as they happen.
                    </p>
                  </td>
                </tr>
              ) : (
                result.items.slice(0, limit).map((activity) => (
                  <tr
                    key={activity.eventId}
                    className="transition-colors hover:bg-white/[0.018]"
                  >
                    <td className="whitespace-nowrap px-5 py-3 align-top text-[#8F879D]">
                      <time
                        dateTime={activity.occurredAt}
                        title={new Date(activity.occurredAt).toISOString()}
                        suppressHydrationWarning
                      >
                        {formatRelativeTime(activity.occurredAt)}
                      </time>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {activity.communityId ? (
                        <Link
                          href={`/products/entry/communities/${activity.communityId}`}
                          className="font-medium text-white transition-colors hover:text-white"
                        >
                          {activity.communityName}
                        </Link>
                      ) : (
                        <span className="font-medium text-[#D3CEDA]">{activity.communityName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className={getEventTextStyle(activity)}>
                        {activity.eventLabel}
                      </span>
                    </td>
                    <td className="max-w-[520px] px-4 py-3 align-top text-[#C7C1CF]">
                      {activity.detail}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 align-top font-medium text-white">
                      {activity.actor}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
