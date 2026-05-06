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
    <article className="flex h-full flex-col rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            {description}
          </p>
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
