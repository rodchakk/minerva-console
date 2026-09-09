"use client";

import Link from "next/link";
import { Timer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  formatFieldWorkClock,
  getFieldWorkClassificationLabel,
  type FieldActiveWorkTimer,
} from "@/features/entry/field/workTimerModel";

type FieldActiveWorkTimerIndicatorProps = {
  session: FieldActiveWorkTimer;
};

function useElapsedSeconds(startedAt: string) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return useMemo(() => {
    const started = new Date(startedAt).getTime();
    if (!Number.isFinite(started)) return 0;
    return Math.max(0, Math.floor((now - started) / 1000));
  }, [now, startedAt]);
}

export function FieldActiveWorkTimerIndicator({
  session,
}: FieldActiveWorkTimerIndicatorProps) {
  const elapsedSeconds = useElapsedSeconds(session.startedAt);

  return (
    <Link
      href="/field/entry/work-timer"
      aria-label="Open active ENTRY work timer"
      className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-lg border border-[var(--console-accent-border)] bg-[var(--console-accent-subtle)] px-3 text-xs font-bold text-[var(--console-text)] transition-colors hover:bg-white/10"
    >
      <span className="relative flex h-3 w-3 shrink-0 items-center justify-center">
        <span className="absolute h-3 w-3 rounded-full bg-[var(--console-accent)] opacity-30" />
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--console-accent)]" />
      </span>
      <Timer aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span className="shrink-0 tabular-nums">
        {formatFieldWorkClock(elapsedSeconds)}
      </span>
      <span aria-hidden="true" className="text-[var(--console-text-soft)]">
        |
      </span>
      <span className="min-w-0 truncate">
        {session.communityName} - {getFieldWorkClassificationLabel(session.classification)}
      </span>
    </Link>
  );
}
