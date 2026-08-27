import { ShieldCheck } from "lucide-react";

const statuses = [
  { label: "Surface", value: "Mobile" },
  { label: "Mode", value: "Read-only" },
  { label: "Product", value: "ENTRY" },
];

export default function FieldEntryPage() {
  return (
    <div className="space-y-5">
      <section className="pt-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--console-accent)]">
          Product
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--console-text)]">
          ENTRY
        </h1>
      </section>

      <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--console-accent-subtle)] text-[var(--console-accent)]">
            <ShieldCheck aria-hidden="true" className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-semibold text-[var(--console-text)]">
              Field foundation
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--console-text-muted)]">
              ENTRY is available as the only Field module in this release.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {statuses.map((status) => (
          <div
            key={status.label}
            className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-text-soft)]">
              {status.label}
            </p>
            <p className="mt-2 text-base font-semibold text-[var(--console-text)]">
              {status.value}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
