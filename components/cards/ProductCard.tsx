import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type ProductCardProps = {
  title: string;
  description: string;
  href: string;
  status: string;
};

export function ProductCard({
  title,
  description,
  href,
  status,
}: ProductCardProps) {
  return (
    <article className="flex h-full flex-col rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <Badge tone="info">{status}</Badge>
      </div>
      <div className="mt-6">
        <Link href={href}>
          <Button>Open module</Button>
        </Link>
      </div>
    </article>
  );
}
