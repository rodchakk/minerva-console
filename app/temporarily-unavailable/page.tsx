"use client";

import { useEffect } from "react";

const RETRY_DELAY_MS = 15_000;

function getSafeNextPath() {
  const candidate = new URLSearchParams(window.location.search).get("next");

  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.startsWith("/temporarily-unavailable")
  ) {
    return "/";
  }

  return candidate;
}

export default function TemporarilyUnavailablePage() {
  useEffect(() => {
    const safeNextPath = getSafeNextPath();

    const retryTimer = window.setTimeout(() => {
      window.location.replace(safeNextPath);
    }, RETRY_DELAY_MS);

    return () => window.clearTimeout(retryTimer);
  }, []);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_35%,rgba(185,28,28,0.12),transparent_30%),radial-gradient(circle_at_78%_70%,rgba(127,29,29,0.08),transparent_32%)]" />

      <section className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#0a0a0a] p-8 text-center shadow-[0_28px_100px_rgba(0,0,0,0.58)] sm:p-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-red-400">
          MINERVA CONSOLE
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-white">
          Service temporarily unavailable
        </h1>
        <p className="mt-4 text-sm leading-7 text-white/55">
          We could not verify your Minerva session or permissions right now.
          Your session is being preserved and this page will retry
          automatically.
        </p>

        <button
          type="button"
          onClick={() => window.location.replace(getSafeNextPath())}
          className="mt-8 w-full rounded-xl bg-red-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-600 active:scale-[0.99]"
        >
          Try again now
        </button>

        <p className="mt-4 text-xs leading-5 text-white/35">
          A temporary provider or network failure is not treated as a sign-out
          or an authorization denial.
        </p>
      </section>
    </main>
  );
}
