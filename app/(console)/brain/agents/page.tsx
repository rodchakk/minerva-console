import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { BrainEyebrow } from "@/features/brain/components/BrainEyebrow";
import { RegistryTable } from "@/features/brain/components/RegistryTable";
import { getAgents } from "@/features/brain/lib/content";

export default function BrainAgentsPage() {
  const agents = getAgents();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Agents"
        description="Internal agent definitions: purpose, allowed tools, disallowed actions, and default prompts. v0 holds definitions only — no run engine."
        eyebrow={<BrainEyebrow />}
      />

      {agents.length === 0 ? (
        <EmptyState
          title="No agents defined yet"
          description="Add entries to content/brain/registries/agents.json and put definitions under content/brain/agents/."
        />
      ) : (
        <RegistryTable
          kind="agents"
          rows={agents.map((a) => ({
            id: a.id,
            title: a.title,
            status: a.status,
            summary: a.summary,
            updated: a.updated,
            tags: a.tags,
          }))}
        />
      )}
    </div>
  );
}
