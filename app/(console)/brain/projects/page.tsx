import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { BrainEyebrow } from "@/features/brain/components/BrainEyebrow";
import { RegistryTable } from "@/features/brain/components/RegistryTable";
import { getProjects } from "@/features/brain/lib/content";

export default function BrainProjectsPage() {
  const projects = getProjects();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Projects"
        description="Minerva products and internal projects, with summaries, status, and boundaries. Long-form context lives under content/brain/projects/."
        eyebrow={<BrainEyebrow />}
      />

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Add entries to content/brain/registries/projects.json and reference long-form notes under content/brain/projects/."
        />
      ) : (
        <RegistryTable
          rows={projects.map((p) => ({
            id: p.id,
            title: p.title,
            status: p.status,
            summary: p.summary,
            updated: p.updated,
            tags: p.tags,
          }))}
        />
      )}
    </div>
  );
}
