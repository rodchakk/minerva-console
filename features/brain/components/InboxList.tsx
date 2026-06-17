import { Badge } from "@/components/ui/Badge";
import type { InboxEntry, InboxStatus } from "@/features/brain/lib/types";

type InboxListProps = {
  items: InboxEntry[];
};

const statusTone: Record<
  InboxStatus,
  "default" | "success" | "warning" | "danger" | "info"
> = {
  inbox: "warning",
  triaged: "info",
  promoted: "success",
  archived: "default",
};

export function InboxList({ items }: InboxListProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/8 px-5 py-4 text-sm leading-6 text-amber-100">
        <p className="font-semibold uppercase tracking-[0.18em] text-amber-200 text-[11px]">
          Raw · Unprocessed
        </p>
        <p className="mt-2 text-amber-100/90">
          Inbox items are raw AI or human outputs that have not been reviewed.
          They are <strong className="font-semibold">not</strong> Brain
          knowledge until a human promotes them into a decision, prompt,
          project, agent, or document.
        </p>
      </div>

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-[var(--text-muted)]">
                    {item.id}
                  </span>
                  <span className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                    {item.source}
                  </span>
                </div>
                <p className="mt-2 text-base font-semibold text-white">
                  {item.title}
                </p>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                  {item.summary}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={statusTone[item.status]}>{item.status}</Badge>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
              <span>Captured {item.created}</span>
              {item.tags.length > 0 ? (
                <>
                  <span>·</span>
                  <div className="flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-md bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
