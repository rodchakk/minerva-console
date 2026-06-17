import { PageHeader } from "@/components/layout/PageHeader";
import { BrainEyebrow } from "@/features/brain/components/BrainEyebrow";
import { BrainOverview } from "@/features/brain/components/BrainOverview";

export default function BrainOverviewPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Brain"
        description="Minerva's internal intelligence layer. Project context, decisions, prompts, agents, missions, and an inbox for raw AI outputs. v0 is Git-backed and read-only."
        eyebrow={<BrainEyebrow />}
      />
      <BrainOverview />
    </div>
  );
}
