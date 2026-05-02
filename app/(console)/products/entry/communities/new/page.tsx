import { PageHeader } from "@/components/layout/PageHeader";
import { CreateCommunityForm } from "@/features/entry/communities/CreateCommunityForm";

export default function NewCommunityPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Create community"
        description="Onboard a new ENTRY community in three steps: details, features, and units import."
      />
      <CreateCommunityForm />
    </div>
  );
}
