"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

function buildEntryResetUrl() {
  if (typeof window === "undefined") {
    return "entry://reset-password";
  }

  const search = window.location.search ?? "";
  const hash = window.location.hash ?? "";

  return `entry://reset-password${search}${hash}`;
}

export default function ResetPasswordBridgePage() {
  const entryResetUrl = useMemo(buildEntryResetUrl, []);

  useEffect(() => {
    window.location.replace(entryResetUrl);
  }, [entryResetUrl]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl rounded-[32px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(17,24,39,0.96),rgba(8,12,22,0.98))] p-8 text-center shadow-[0_24px_70px_rgba(2,6,23,0.28)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-200">
          Minerva Console
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-white">
          Opening ENTRY password reset
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
          We are sending this recovery link to the ENTRY app now. If the app
          does not open automatically, use the button below.
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href={entryResetUrl}>
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
