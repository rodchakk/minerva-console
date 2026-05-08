import { PageHeader } from "@/components/layout/PageHeader";
import { EntryMessagesClient } from "@/features/entry/messages/EntryMessagesClient";
import { getEntryMessagesPageData } from "@/features/entry/messages/queries";

export default async function EntryMessagesPage() {
  const { communities, loadError } = await getEntryMessagesPageData();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Minerva messages"
        description="Publish official Minerva updates to ENTRY communities."
      />
      <EntryMessagesClient communities={communities} loadError={loadError} />
    </div>
  );
}
