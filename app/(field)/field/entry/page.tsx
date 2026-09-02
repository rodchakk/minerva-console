import Link from "next/link";
import {
  ArrowRight,
  MapPinHouse,
  MessageSquareText,
  ShieldCheck,
  UserRoundSearch,
} from "lucide-react";

const taskCardClass =
  "group flex min-h-20 items-center gap-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-3.5 transition-colors hover:border-[var(--console-accent-border)] hover:bg-[var(--console-surface-hover)] active:bg-white/[0.08]";
const iconClass =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--console-accent-subtle)] text-[var(--console-accent)]";

export default async function FieldEntryPage() {
  return (
    <div className="space-y-4">
      <section className="pt-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--console-accent)]">
          ENTRY Field
        </p>
        <h1 className="mt-1.5 text-3xl font-semibold text-[var(--console-text)]">
          ENTRY
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-5 text-[var(--console-text-muted)]">
          What are you working on?
        </p>
      </section>

      <section className="grid gap-2.5" aria-label="ENTRY task choices">
        <Link href="/field/entry/tickets" className={taskCardClass}>
          <span className={iconClass}>
            <MessageSquareText aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold text-[var(--console-text)]">
              Tickets
            </span>
            <span className="mt-0.5 block break-words text-sm leading-5 text-[var(--console-text-muted)]">
              Support conversations and quick actions
            </span>
          </span>
          <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--console-text-soft)] transition-colors group-hover:text-[var(--console-text)]" />
        </Link>

        <Link href="/field/entry/communities" className={taskCardClass}>
          <span className={iconClass}>
            <MapPinHouse aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold text-[var(--console-text)]">
              Communities
            </span>
            <span className="mt-0.5 block break-words text-sm leading-5 text-[var(--console-text-muted)]">
              Registration, units, setup and community work
            </span>
          </span>
          <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--console-text-soft)] transition-colors group-hover:text-[var(--console-text)]" />
        </Link>

        <Link href="/field/entry/people" className={taskCardClass}>
          <span className={iconClass}>
            <UserRoundSearch aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold text-[var(--console-text)]">
              People
            </span>
            <span className="mt-0.5 block break-words text-sm leading-5 text-[var(--console-text-muted)]">
              Accounts, activation and resident support
            </span>
          </span>
          <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--console-text-soft)] transition-colors group-hover:text-[var(--console-text)]" />
        </Link>

        <Link href="/field/entry/access" className={taskCardClass}>
          <span className={iconClass}>
            <ShieldCheck aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold text-[var(--console-text)]">
              Access
            </span>
            <span className="mt-0.5 block break-words text-sm leading-5 text-[var(--console-text-muted)]">
              Roles and guard accounts
            </span>
          </span>
          <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--console-text-soft)] transition-colors group-hover:text-[var(--console-text)]" />
        </Link>
      </section>
    </div>
  );
}
