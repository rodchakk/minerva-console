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

  return <OutriderDetailWorkspace detail={detail} />;
}
