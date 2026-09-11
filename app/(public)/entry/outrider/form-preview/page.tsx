import { OutriderFormPreview } from "@/features/entry/outrider/public/OutriderFormPreview";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ENTRY Outrider · Form preview",
  robots: { index: false, follow: false },
};

export default function OutriderFormPreviewPage() {
  return <OutriderFormPreview />;
}
