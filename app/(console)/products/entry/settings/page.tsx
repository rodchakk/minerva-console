import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function EntrySettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="ENTRY settings"
        description="Reserved for future product configuration and feature-level operational controls."
      />
      <EmptyState
        title="Settings module coming next"
        description="The product shell is ready, but no additional ENTRY settings have been connected yet."
      />
    </div>
  );
}
