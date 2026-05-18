"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

function buildEntryActivateUrl() {
  if (typeof window === "undefined") {
    return "entry://activate";
  }

  const search = window.location.search ?? "";
  return `entry://activate${search}`;
}

export default function ActivateBridgePage() {
  const entryActivateUrl = useMemo(buildEntryActivateUrl, []);

  useEffect(() => {
    window.location.replace(entryActivateUrl);
  }, [entryActivateUrl]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl rounded-[32px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(17,24,39,0.96),rgba(8,12,22,0.98))] p-8 text-center shadow-[0_24px_70px_rgba(2,6,23,0.28)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-200">
          Minerva Console
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-white">
          Opening ENTRY activation
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
          We are opening the ENTRY app now to complete your activation. If the
          app does not open automatically, use the button below.
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href={entryActivateUrl}>
            <Button>Open ENTRY app</Button>
          </a>
          <Link href="/login">
            <Button variant="secondary">Back to console login</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
