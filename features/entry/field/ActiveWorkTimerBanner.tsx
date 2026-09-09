"use client";

import Link from "next/link";
import { Timer } from "lucide-react";
import { useEffect, useState } from "react";
import {
  formatTimerDuration,
  getElapsedSeconds,
  getFieldWorkActivitySummaryLabel,
  getFieldWorkTargetLabel,
  type FieldWorkSession,
} from "@/features/entry/field/workTimerModel";

type ActiveWorkTimerBannerProps = {
  generatedAtIso: string;
  session: FieldWorkSession;
};

export function ActiveWorkTimerBanner({
  generatedAtIso,
  session,
}: ActiveWorkTimerBannerProps) {
  const [now, setNow] = useState(() => new Date(generatedAtIso));

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const elapsedSeconds = getElapsedSeconds(session.startedAt, now);
  const targetLabel = getFieldWorkTargetLabel(session);
  const activityLabel = getFieldWorkActivitySummaryLabel(
    session.activityCategory,
  );

  return (
    <div className="sticky top-[65px] z-20 border-b border-[var(--console-border)] bg-[rgba(20,20,20,0.94)] px-4 py-2 backdrop-blur">
      <Link
        href="/field/entry/time"
        className="mx-auto flex min-h-11 max-w-4xl items-center gap-2 rounded-lg border border-[var(--console-accent-border)] bg-[var(--console-accent-subtle)] px-3 text-sm font-semibold text-[var(--console-text)]"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--console-accent)] text-white">
          <Timer aria-hidden="true" className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate">
          {formatTimerDuration(elapsedSeconds)} / {targetLabel} / {activityLabel}
        </span>
      </Link>
    </div>
  );
}
