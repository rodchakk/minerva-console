import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { BrainEyebrow } from "@/features/brain/components/BrainEyebrow";
import { getMissions } from "@/features/brain/lib/content";
import type { MissionStatus } from "@/features/brain/lib/types";

const statusTone: Record<
  MissionStatus,
  "default" | "success" | "warning" | "danger" | "info"
> = {
  planned: "warning",
  in_progress: "info",
  completed: "success",
};

function CompactValue({ value }: { value: string }) {
  return value ? (
    <span className="font-mono text-xs text-slate-300">{value}</span>
  ) : (
    <span className="text-xs text-[var(--text-muted)]">-</span>
  );
}

export default function BrainMissionsPage() {
  const missions = getMissions();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Missions"
        description="Git-backed mission control ledger for Brain work. Read-only in the app."
        eyebrow={<BrainEyebrow />}
      />

      {missions.length === 0 ? (
        <EmptyState
          title="No missions yet"
          description="Add entries to content/brain/registries/missions.json and reference long-form notes under content/brain/missions/."
        />
      ) : (
        <div className="overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-strong)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <tr>
                <th className="px-5 py-3">ID</th>
                <th className="px-5 py-3">Mission</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Phase</th>
                <th className="px-5 py-3">Agent</th>
                <th className="px-5 py-3">Branch</th>
                <th className="px-5 py-3">PR</th>
                <th className="px-5 py-3">Commit</th>
              </tr>
            </thead>
            <tbody>
              {missions.map((mission) => (
                <tr
                  key={mission.id}
                  className="border-b border-[var(--border)] last:border-b-0 align-top"
                >
                  <td className="px-5 py-4 font-mono text-xs text-[var(--text-muted)]">
                    <Link
                      href={`/brain/missions/${mission.id}`}
                      className="hover:text-sky-400"
                    >
                      {mission.id}
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/brain/missions/${mission.id}`}
                      className="font-medium text-white hover:text-sky-400"
                    >
                      {mission.title}
                    </Link>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--text-muted)]">
                      {mission.summary}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone={statusTone[mission.status]}>
                      {mission.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-300">
                    {mission.phase || "-"}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-300">
                    {mission.agent || "-"}
                  </td>
                  <td className="px-5 py-4">
                    <CompactValue value={mission.branch} />
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-300">
                    {mission.pr || "-"}
                  </td>
                  <td className="px-5 py-4">
                    <CompactValue value={mission.commit} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
