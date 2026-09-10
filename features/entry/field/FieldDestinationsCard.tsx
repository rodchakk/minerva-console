import { MapPin } from "lucide-react";
import type { CommunityDetailPreviews } from "@/features/entry/communities/detailQueries";

export function FieldDestinationsCard({
  destinations,
}: {
  destinations: CommunityDetailPreviews["destinations"];
}) {
  const isAvailable = destinations.state !== "unavailable";
  const visibleDestinations = isAvailable ? destinations.items.slice(0, 5) : [];
  const remaining = isAvailable
    ? Math.max(0, destinations.items.length - visibleDestinations.length)
    : 0;

  return (
    <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <MapPin aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--console-accent)]" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
              Access destinations
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--console-text)]">
              Configured destinations
            </h2>
          </div>
        </div>
        {isAvailable ? (
          <span className="shrink-0 text-xs font-semibold text-[var(--console-text-soft)]">
            {destinations.items.length} configured
          </span>
        ) : null}
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
        <div className="mt-3 divide-y divide-[var(--console-border)] border-y border-[var(--console-border)]">
          {visibleDestinations.map((destination) => (
            <div key={destination.id} className="flex min-h-12 items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--console-text)]">
                  {destination.name}
                </p>
                {destination.category ? (
                  <p className="mt-0.5 truncate text-xs text-[var(--console-text-soft)]">
                    {destination.category}
                  </p>
                ) : null}
              </div>
              <span
                className={`shrink-0 text-xs font-semibold ${
                  destination.isActive ? "text-emerald-300" : "text-[var(--console-text-soft)]"
                }`}
              >
                {destination.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          ))}
        </div>
      )}

      {remaining > 0 ? (
        <p className="mt-3 text-xs text-[var(--console-text-muted)]">
          + {remaining} more configured in Console
        </p>
      ) : null}
      <p className="mt-3 text-xs leading-5 text-[var(--console-text-soft)]">
        Field is for onsite verification. Destination editing remains in Console.
      </p>
    </section>
  );
}
