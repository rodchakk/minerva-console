import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";

export default function EntryMessagesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Minerva messages"
        description="Publish official Minerva updates to ENTRY communities."
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_320px]">
        <div className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
          <div className="mb-6 inline-flex items-center rounded-full bg-violet-500/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-violet-200 ring-1 ring-inset ring-violet-400/20">
            Backend wiring pending
          </div>

          <form className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">Community</span>
                <select
                  disabled
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-slate-400"
                >
                  <option>Select community</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">Audience</span>
                <select
                  disabled
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-slate-400"
                >
                  <option>Choose audience</option>
                </select>
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Title</span>
              <input
                disabled
                placeholder="Official update title"
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-slate-400"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Message</span>
              <textarea
                disabled
                rows={8}
                placeholder="Write the message that will be sent to selected ENTRY communities."
                className="w-full rounded-[24px] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-slate-400"
              />
            </label>

            <Button type="button" disabled>
              Publish coming soon
            </Button>
          </form>
        </div>

        <aside className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
          <h2 className="text-lg font-semibold text-white">Future behavior</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
            Backend wiring is still pending, but this surface is prepared for the
            eventual sending workflow.
          </p>
          <div className="mt-5 space-y-3">
            {[
              "Send to one community",
              "Send to all communities",
              "Target admins, guards, or residents",
              "Push notification support",
            ].map((item) => (
              <div
                key={item}
                className="rounded-[24px] border border-white/8 bg-white/4 px-4 py-3"
              >
                <p className="text-sm font-semibold text-white">{item}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
