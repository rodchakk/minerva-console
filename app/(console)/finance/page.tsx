import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function FinancePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Finance"
        description="Reserved for global financial visibility and internal finance workflows."
      />
      <EmptyState
        title="Finance module placeholder"
        description="The layout, sidebar hierarchy, and dashboard information architecture already support this area once finance data sources are ready."
      />
    </div>
  );
}
