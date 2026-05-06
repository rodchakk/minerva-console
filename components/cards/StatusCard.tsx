import { Badge } from "@/components/ui/Badge";

type StatusCardProps = {
  title: string;
  description: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
};

export function StatusCard({
  title,
  description,
  tone = "default",
}: StatusCardProps) {
  return (
    <article className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <Badge tone={tone}>{title}</Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{description}</p>
    </article>
  );
}
