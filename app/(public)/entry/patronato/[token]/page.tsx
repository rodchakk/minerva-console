import type { Metadata } from "next";
import { PatronatoReviewMobile } from "@/features/entry/communityRegistration/patronato/PatronatoReviewMobile";
import { resolvePatronatoReview } from "@/features/entry/communityRegistration/patronato/gateway";
import { hashPatronatoReviewToken } from "@/features/entry/communityRegistration/patronato/token";
import { getEntryDeploymentBoundary } from "@/features/entry/deploymentBoundary";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const title = "Revisión del Patronato | ENTRY";
const description =
  "Revisión segura de viviendas preparadas para activación en ENTRY.";
const image =
  "https://console.minervatechs.com/brand/minerva-entry-og-v5-baseline-1200x630.jpg";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    type: "website",
    siteName: "ENTRY · Minerva Technologies",
    title,
    description,
    images: [{ url: image, width: 1200, height: 630, alt: "ENTRY por Minerva" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [image],
  },
  robots: { follow: false, index: false },
};

function Unavailable() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 text-slate-950">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-black tracking-tight text-blue-700">ENTRY</p>
        <h1 className="mt-3 text-2xl font-black">Enlace no disponible</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Solicite a Minerva un nuevo enlace de revisión del Patronato.
        </p>
      </div>
    </main>
  );
}

export default async function PatronatoReviewPage(
  props: PageProps<"/entry/patronato/[token]">,
) {
  const { token: rawToken } = await props.params;
  const token = rawToken.trim();

  if (token.length < 32) return <Unavailable />;

  const session = await resolvePatronatoReview(
    hashPatronatoReviewToken(token),
  );

  if (!session.available) return <Unavailable />;

  return (
    <PatronatoReviewMobile
      previewReadOnly={getEntryDeploymentBoundary().previewReadOnly}
      session={session}
      token={token}
    />
  );
}

export const viewport = {
  initialScale: 1,
  width: "device-width",
};
