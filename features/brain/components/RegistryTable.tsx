import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { EntryStatus } from "@/features/brain/lib/types";

type RegistryRow = {
  id: string;
  title: string;
  status: EntryStatus;
  summary: string;
  updated: string;
  tags: string[];
  /** Optional extra column value (e.g. version for prompts). */
  extra?: string;
};

type RegistryTableProps = {
  rows: RegistryRow[];
  /** Plural kind for building detail links, e.g. "projects". */
  kind: string;
  /** Optional header label for the `extra` column. */
  extraLabel?: string;
};

const statusTone: Record<
  EntryStatus,
  "default" | "success" | "warning" | "danger" | "info"
> = {
  draft: "warning",
  approved: "success",
  archived: "default",
};

export function RegistryTable({ rows, kind, extraLabel }: RegistryTableProps) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-[var(--border)] bg-[var(--surface-strong)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          <tr>
            <th className="px-5 py-3">ID</th>
            <th className="px-5 py-3">Title</th>
            <th className="px-5 py-3">Status</th>
            {extraLabel ? <th className="px-5 py-3">{extraLabel}</th> : null}
            <th className="px-5 py-3">Tags</th>
            <th className="px-5 py-3">Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-[var(--border)] last:border-b-0 align-top"
            >
              <td className="px-5 py-4 font-mono text-xs text-[var(--text-muted)]">
                <Link
                  href={`/brain/${kind}/${row.id}`}
                  className="hover:text-sky-400"
                >
                  {row.id}
                </Link>
              </td>
              <td className="px-5 py-4">
                <Link
                  href={`/brain/${kind}/${row.id}`}
                  className="font-medium text-white hover:text-sky-400"
                >
                  {row.title}
                </Link>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--text-muted)]">
                  {row.summary}
                </p>
              </td>
              <td className="px-5 py-4">
                <Badge tone={statusTone[row.status]}>{row.status}</Badge>
              </td>
              {extraLabel ? (
                <td className="px-5 py-4 text-xs text-[var(--text-muted)]">
                  {row.extra ?? "—"}
                </td>
              ) : null}
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-1.5">
                  {row.tags.length === 0 ? (
                    <span className="text-xs text-[var(--text-muted)]">—</span>
                  ) : (
                    row.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-md bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-300"
                      >
                        {tag}
                      </span>
                    ))
                  )}
                </div>
              </td>
              <td className="px-5 py-4 text-xs text-[var(--text-muted)]">
                {row.updated}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
