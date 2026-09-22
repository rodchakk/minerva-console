import type { Metadata } from "next";
import { PatronatoReviewMobile } from "@/features/entry/communityRegistration/patronato/PatronatoReviewMobile";
import {
  resolvePatronatoReview,
  type PatronatoReviewSession,
} from "@/features/entry/communityRegistration/patronato/gateway";
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

function previewSession(): PatronatoReviewSession {
  return {
    available: true,
    campaignId: "preview-campaign",
    campaignStatus: "open",
    communityId: "preview-community",
    communityName: "Residencial Andalucía",
    expiresAt: null,
    publicTitle: "Revisión de viviendas",
    summary: {
      approved: 2,
      hold: 1,
      pending: 4,
      processed: 1,
    },
    units: [
      {
        holdNote: null,
        id: "preview-1419",
        label: "1419",
        patronatoConfirmedAt: null,
        reference: "14 avenida · entre 13 y 14 calle",
        residentCount: 3,
        residents: [
          { fullName: "Juan Pérez", isPrimary: true, position: 1 },
          { fullName: "Ana Pérez", isPrimary: false, position: 2 },
          { fullName: "Mateo Pérez", isPrimary: false, position: 3 },
        ],
        reviewState: "pending",
        reviewedAt: "2026-09-22T06:00:00.000Z",
        status: "reviewed",
      },
      {
        holdNote: null,
        id: "preview-1424",
        label: "1424",
        patronatoConfirmedAt: null,
        reference: "Calle principal · frente al parque",
        residentCount: 2,
        residents: [
          { fullName: "Carlos Reyes", isPrimary: true, position: 1 },
          { fullName: "María Reyes", isPrimary: false, position: 2 },
        ],
        reviewState: "pending",
        reviewedAt: "2026-09-22T06:02:00.000Z",
        status: "reviewed",
      },
      {
        holdNote: "Pendiente de validación administrativa.",
        id: "preview-1602",
        label: "1602",
        patronatoConfirmedAt: null,
        reference: "Bloque B · segunda entrada",
        residentCount: 2,
        residents: [
          { fullName: "Sofía Martínez", isPrimary: true, position: 1 },
          { fullName: "Daniel Martínez", isPrimary: false, position: 2 },
        ],
        reviewState: "hold",
        reviewedAt: "2026-09-22T06:05:00.000Z",
        status: "reviewed",
      },
      {
        holdNote: null,
        id: "preview-1511",
        label: "1511",
        patronatoConfirmedAt: "2026-09-22T06:10:00.000Z",
        reference: "15 calle · lote 11",
        residentCount: 1,
        residents: [
          { fullName: "María López", isPrimary: true, position: 1 },
        ],
        reviewState: "approved",
        reviewedAt: "2026-09-22T06:07:00.000Z",
        status: "confirmed",
      },
      {
        holdNote: null,
        id: "preview-1504",
        label: "1504",
        patronatoConfirmedAt: "2026-09-22T05:55:00.000Z",
        reference: "15 avenida · casa 04",
        residentCount: 2,
        residents: [
          { fullName: "Roberto Díaz", isPrimary: true, position: 1 },
          { fullName: "Elena Díaz", isPrimary: false, position: 2 },
        ],
        reviewState: "processed",
        reviewedAt: "2026-09-22T05:45:00.000Z",
        status: "processed",
      },
      {
        holdNote: null,
        id: "preview-1408",
        label: "1408",
        patronatoConfirmedAt: null,
        reference: "14 calle · vivienda 08",
        residentCount: 1,
        residents: [
          { fullName: "Andrea Molina", isPrimary: true, position: 1 },
        ],
        reviewState: "pending",
        reviewedAt: "2026-09-22T06:12:00.000Z",
        status: "reviewed",
      },
      {
        holdNote: null,
        id: "preview-1423",
        label: "1423",
        patronatoConfirmedAt: "2026-09-22T06:15:00.000Z",
        reference: null,
        residentCount: 2,
        residents: [
          { fullName: "Pedro García", isPrimary: true, position: 1 },
          { fullName: "Lucía García", isPrimary: false, position: 2 },
        ],
        reviewState: "approved",
        reviewedAt: "2026-09-22T06:14:00.000Z",
        status: "confirmed",
      },
      {
        holdNote: null,
        id: "preview-1420",
        label: "1420",
        patronatoConfirmedAt: null,
        reference: "14 calle · vivienda 20",
        residentCount: 2,
        residents: [
          { fullName: "José Flores", isPrimary: true, position: 1 },
          { fullName: "Laura Flores", isPrimary: false, position: 2 },
        ],
        reviewState: "pending",
        reviewedAt: "2026-09-22T06:16:00.000Z",
        status: "reviewed",
      },
    ],
  };
}

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
  const deployment = getEntryDeploymentBoundary();

  if (deployment.previewReadOnly && token === "preview") {
    return (
      <PatronatoReviewMobile
        previewReadOnly
        session={previewSession()}
        token="preview"
      />
    );
  }

  if (token.length < 32) return <Unavailable />;

  const session = await resolvePatronatoReview(
    hashPatronatoReviewToken(token),
  );

  if (!session.available) return <Unavailable />;

  return (
    <PatronatoReviewMobile
      previewReadOnly={deployment.previewReadOnly}
      session={session}
      token={token}
    />
  );
}

export const viewport = {
  initialScale: 1,
  width: "device-width",
};
