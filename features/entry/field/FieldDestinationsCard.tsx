import { MapPin } from "lucide-react";
import type { CommunityDetailPreviews } from "@/features/entry/communities/detailQueries";

export function FieldDestinationsCard({
  destinations,
}: {
  destinations: CommunityDetailPreviews["destinations"];
}) {
  return (
    <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
      <div className="flex items-center gap-2">
        <MapPin
          aria-hidden="true"
          className="h-4 w-4 text-[var(--console-accent)]"
        />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
            Access destinations
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--console-text)]">
            Configured destinations
          </h2>
        </div>
      </div>

      {destinations.state === "unavailable" ? (
        <p className="mt-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
          Access destinations are unavailable right now.
        </p>
      ) : destinations.items.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-[var(--console-text-muted)]">
          No manual access destinations are configured for this community.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {destinations.items.map((destination) => (
            <div
              key={destination.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-[var(--console-border)] bg-white/[0.03] px-3 py-3"
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-[var(--console-text)]">
                  {destination.name}
                </p>
                {destination.category ? (
                  <p className="mt-1 break-words text-xs text-[var(--console-text-soft)]">
                    {destination.category}
                  </p>
                ) : null}
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${
                  destination.isActive
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                    : "border-white/15 bg-white/5 text-[var(--console-text-soft)]"
                }`}
              >
                {destination.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs leading-5 text-[var(--console-text-soft)]">
        Field shows destination status for onsite verification. Destination editing remains in Console.
      </p>
    </section>
  );
}
