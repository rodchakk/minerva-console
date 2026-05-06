import { Badge } from "@/components/ui/Badge";

type MetricCardProps = {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  status: string;
};

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
  status,
}: MetricCardProps) {
  return (
    <article className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--text-muted)]">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
            {value}
          </p>
        </div>
        <Badge tone={tone}>{status}</Badge>
      </div>
      <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{hint}</p>
    </article>
  );
}
