import Link from "next/link";
import { ArrowLeft, ExternalLink, MapPinned, ShieldAlert } from "lucide-react";

// Pinned audit candidate. Do not point to the old 0.2 production alias or
// silently advance this link without reviewing the tested deployment.
const INDOOR_PILOT_URL =
  "https://minerva-indoor-field-test-k7948at6h-rudychacon01-9213s-projects.vercel.app";

export default function FieldIndoorPage() {
  return (
    <div className="space-y-5">
      <Link
        href="/field"
        className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[var(--console-text-muted)] hover:text-[var(--console-text)]"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Field
      </Link>

      <section className="pt-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--console-accent)]">
          Minerva Field / Tools
        </p>
        <div className="mt-2 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--console-accent-border)] bg-[var(--console-accent-subtle)] text-[var(--console-accent)]">
            <MapPinned aria-hidden="true" className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-3xl font-semibold text-[var(--console-text)]">
              INDOOR
            </h1>
            <p className="text-sm text-[var(--console-text-muted)]">
              Indoor location research
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex items-center gap-2 text-[var(--console-accent)]">
          <ShieldAlert aria-hidden="true" className="h-5 w-5 shrink-0" />
          <h2 className="text-sm font-bold">Pilot only · Field Test 0.2.1</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-[var(--console-text-muted)]">
          GPS trace capture, marked locations, photos and observations.
          This candidate has automated checks, but physical Android and iPhone
          QA is still pending. Not cleared for full terminal mapping.
        </p>
        <a
          href={INDOOR_PILOT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-[var(--console-accent-border)] bg-[var(--console-accent)] px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          Open INDOOR Field Test
          <ExternalLink aria-hidden="true" className="h-4 w-4" />
        </a>
        <p className="mt-3 text-xs leading-5 text-[var(--console-text-muted)]">
          Opens the separate pilot site in your browser. Vercel may require
          team sign-in to access this preview. GPS data and photographs remain
          in that site's browser storage, not in ENTRY or Minerva Console.
          Export your JSON before clearing browser data or switching devices.
        </p>
      </section>
    </div>
  );
}
