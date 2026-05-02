import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Reserved for global console settings, access policies, and internal operational preferences."
      />
      <EmptyState
        title="Global settings placeholder"
        description="Only the authorization boundary is live today. Future settings can plug into this module without changing the protected shell."
      />
    </div>
  );
}
