import { CircleGauge } from "lucide-react";

export default function SeshatPage() {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-white/[0.10] bg-[#10151b] p-6 shadow-[0_20px_55px_rgba(0,0,0,0.22)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-sky-300/20 bg-sky-400/10 text-sky-300">
                <CircleGauge className="h-5 w-5 stroke-[1.75]" />
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-normal text-white lg:text-[2rem]">
                  Seshat
                </h1>
                <p className="mt-1 text-sm leading-6 text-[var(--console-text-muted)]">
                  Seshat will become the finance workspace inside Minerva Console.
                </p>
              </div>
            </div>
          </div>
          <span className="inline-flex w-fit items-center rounded-md border border-amber-300/20 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-100">
            Coming soon
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-4">
            <p className="text-sm font-semibold text-white">Cost tracking</p>
            <p className="mt-1 text-sm leading-6 text-[var(--console-text-muted)]">
              Reserved for future finance visibility without active functionality.
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-4">
            <p className="text-sm font-semibold text-white">Revenue operations and invoices</p>
            <p className="mt-1 text-sm leading-6 text-[var(--console-text-muted)]">
              No Seshat functionality or runtime is active in Phase 1.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
