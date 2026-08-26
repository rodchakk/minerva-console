import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { FIELD_MODULES } from "@/features/field/modules";

export default function FieldHomePage() {
  return (
    <div className="space-y-5">
      <section className="pt-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--console-accent)]">
          Minerva
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--console-text)]">
          Field
        </h1>
      </section>

      <section className="grid gap-3">
        {FIELD_MODULES.map((module) => (
          <Link
            key={module.id}
            href={module.href}
            className="group rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4 transition-colors hover:border-[var(--console-accent-border)] hover:bg-[var(--console-surface-hover)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--console-accent-subtle)] text-[var(--console-accent)]">
                  <ShieldCheck aria-hidden="true" className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-[var(--console-text)]">
                    {module.label}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--console-text-muted)]">
                    {module.summary}
                  </p>
                </div>
              </div>
              <ArrowRight
                aria-hidden="true"
                className="mt-1 h-5 w-5 shrink-0 text-[var(--console-text-soft)] transition-colors group-hover:text-[var(--console-text)]"
              />
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
