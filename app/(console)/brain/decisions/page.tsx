import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { BrainEyebrow } from "@/features/brain/components/BrainEyebrow";
import { RegistryTable } from "@/features/brain/components/RegistryTable";
import { getDecisions } from "@/features/brain/lib/content";

export default function BrainDecisionsPage() {
  const decisions = getDecisions();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Decisions"
        description="Approved architectural and product decisions for Brain and Minerva products. Append-only — superseded decisions are added, not overwritten."
        eyebrow={<BrainEyebrow />}
      />

      {decisions.length === 0 ? (
        <EmptyState
          title="No decisions recorded yet"
          description="Append new decisions to content/brain/registries/decisions.json. Long-form rationale lives in content/brain/harness/03_DECISIONS.md."
        />
      ) : (
        <RegistryTable
          kind="decisions"
          rows={decisions.map((d) => ({
            id: d.id,
            title: d.title,
            status: d.status,
            summary: d.summary,
            updated: d.updated,
            tags: d.tags,
          }))}
        />
      )}
    </div>
  );
}
