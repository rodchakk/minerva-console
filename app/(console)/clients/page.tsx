import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ClientsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Clients"
        description="Future client portfolio and account management area for Minerva Console."
      />
      <EmptyState
        title="Clients module placeholder"
        description="This section is intentionally scaffolded now so future business modules can land without reworking the shell or navigation."
      />
    </div>
  );
}
