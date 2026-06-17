import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { BrainEyebrow } from "@/features/brain/components/BrainEyebrow";
import { RegistryTable } from "@/features/brain/components/RegistryTable";
import { getPrompts } from "@/features/brain/lib/content";

export default function BrainPromptsPage() {
  const prompts = getPrompts();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Prompts"
        description="Versioned prompts that Minerva runs against AI models. Bodies live in content/brain/prompts/; bump the version when a prompt changes."
        eyebrow={<BrainEyebrow />}
      />

      {prompts.length === 0 ? (
        <EmptyState
          title="No prompts yet"
          description="Add entries to content/brain/registries/prompts.json and put bodies under content/brain/prompts/."
        />
      ) : (
        <RegistryTable
          extraLabel="Version"
          rows={prompts.map((p) => ({
            id: p.id,
            title: p.title,
            status: p.status,
            summary: p.summary,
            updated: p.updated,
            tags: p.tags,
            extra: p.version,
          }))}
        />
      )}
    </div>
  );
}
