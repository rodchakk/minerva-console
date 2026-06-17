import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { BrainEyebrow } from "@/features/brain/components/BrainEyebrow";
import { InboxList } from "@/features/brain/components/InboxList";
import { getInbox } from "@/features/brain/lib/content";

export default function BrainInboxPage() {
  const items = getInbox();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Inbox"
        description="Raw, unprocessed outputs from Claude Code, GPT, Codex, Gemini, or humans. Inbox items are not Brain knowledge — they must be triaged and promoted by a human first."
        eyebrow={<BrainEyebrow />}
      />

      {items.length === 0 ? (
        <EmptyState
          title="Inbox is empty"
          description="Drop new items into content/brain/inbox/ and add a matching entry to content/brain/registries/inbox.json with status: inbox."
        />
      ) : (
        <InboxList items={items} />
      )}
    </div>
  );
}
