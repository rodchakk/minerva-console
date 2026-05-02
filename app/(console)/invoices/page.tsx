import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function InvoicesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Invoices"
        description="Reserved for invoice workflows, collections visibility, and future back-office tooling."
      />
      <EmptyState
        title="Invoices module placeholder"
        description="No invoice workflows are wired yet, but this section is polished and ready for future internal operations."
      />
    </div>
  );
}
