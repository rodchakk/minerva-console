import { ScrollText } from "lucide-react";

export default function LogsPage() {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-white/[0.10] bg-[#10151b] p-6 shadow-[0_20px_55px_rgba(0,0,0,0.22)]">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-sky-300/20 bg-sky-400/10 text-sky-300">
            <ScrollText className="h-5 w-5 stroke-[1.75]" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-normal text-white lg:text-[2rem]">
              Logs
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--console-text-muted)]">
              Operational logs and system history will live here.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-dashed border-white/[0.16] bg-white/[0.018] p-6 text-center">
          <p className="text-sm font-semibold text-white">No logs available yet.</p>
          <p className="mt-1 text-sm leading-6 text-[var(--console-text-muted)]">
            Logging infrastructure is not part of Phase 1.
          </p>
        </div>
      </section>
    </div>
  );
}
