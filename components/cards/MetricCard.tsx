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
    <article className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {value}
          </p>
        </div>
        <Badge tone={tone}>{status}</Badge>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{hint}</p>
    </article>
  );
}
