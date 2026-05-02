import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports"
        description="Reserved for executive reporting, cross-product KPIs, and scheduled exports."
      />
      <EmptyState
        title="Reports module placeholder"
        description="The global dashboard handles top-level visibility; this section is prepared for deeper reports once report feeds are defined."
      />
    </div>
  );
}
