import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { OutriderDetailWorkspace } from "@/features/entry/outrider/internal/OutriderDetailWorkspace";
import { getOutriderDetail } from "@/features/entry/outrider/queries";

export const dynamic = "force-dynamic";

export default async function EntryOutriderDetailPage(
  props: { params: Promise<{ outriderId: string }> },
) {
  const params = await props.params;
  const detail = await getOutriderDetail(params.outriderId);

  if (!detail) {
    notFound();
  }

  return (
    <div>
      <div className="px-0.5 pt-3">
        <Link
          href="/products/entry"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--console-border-strong)] bg-white/[0.025] px-3.5 text-sm font-semibold text-slate-100 transition-colors hover:border-white/20 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50"
        >
          <ArrowLeft className="h-4 w-4 stroke-[1.75]" />
          Operations
        </Link>
      </div>
      <OutriderDetailWorkspace detail={detail} />
    </div>
  );
}
