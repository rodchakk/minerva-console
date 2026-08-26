import { EntryMessagesClient } from "@/features/entry/messages/EntryMessagesClient";
import { getEntryMessagesPageData } from "@/features/entry/messages/queries";

export default async function EntryMessagesPage() {
  const { communities, loadError } = await getEntryMessagesPageData();

  return (
    <div className="space-y-5">
      <section className="px-0.5 pt-5">
        <div className="min-w-0 max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">
            ENTRY MESSAGING
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white lg:text-[2.05rem]">
            Minerva messages
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
            Publish official Minerva updates to ENTRY communities.
          </p>
        </div>
      </section>

      <EntryMessagesClient communities={communities} loadError={loadError} />
    </div>
  );
}
