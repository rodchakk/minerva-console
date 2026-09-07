import type { Metadata } from "next";

const DEFAULT_PUBLIC_METADATA_BASE = "http://localhost:3000";

function normalizeMetadataBase(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function getPublicMetadataBase() {
  return (
    normalizeMetadataBase(process.env.ENTRY_PUBLIC_RESIDENT_BASE_URL) ??
    normalizeMetadataBase(process.env.NEXT_PUBLIC_MINERVA_CONSOLE_URL) ??
    normalizeMetadataBase(process.env.NEXT_PUBLIC_SITE_URL) ??
    normalizeMetadataBase(
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    ) ??
    new URL(DEFAULT_PUBLIC_METADATA_BASE)
  );
}

export const entryRegistrationMetadata: Metadata = {
  description: "Complete su registro para continuar en ENTRY.",
  metadataBase: getPublicMetadataBase(),
  openGraph: {
    description: "Complete su registro para continuar en ENTRY.",
    images: [
      {
        alt: "ENTRY Registro",
        height: 630,
        url: "/og/entry-registration.png",
        width: 1200,
      },
    ],
    siteName: "ENTRY",
    title: "ENTRY | Registro",
    type: "website",
  },
  robots: {
    follow: false,
    index: false,
  },
  title: "ENTRY | Registro",
  twitter: {
    card: "summary_large_image",
    description: "Complete su registro para continuar en ENTRY.",
    images: ["/og/entry-registration.png"],
    title: "ENTRY | Registro",
  },
};

export const outriderPublicMetadata: Metadata = {
  description: "Preparación de comunidad para implementar ENTRY.",
  metadataBase: getPublicMetadataBase(),
  openGraph: {
    description: "Preparación de comunidad para implementar ENTRY.",
    images: [
      {
        alt: "Outrider | Minerva Technologies",
        height: 630,
        url: "/og/outrider.png",
        width: 1200,
      },
    ],
    siteName: "Minerva Technologies",
    title: "Outrider | Minerva Technologies",
    type: "website",
  },
  robots: {
    follow: false,
    index: false,
  },
  title: "Outrider | Minerva Technologies",
  twitter: {
    card: "summary_large_image",
    description: "Preparación de comunidad para implementar ENTRY.",
    images: ["/og/outrider.png"],
    title: "Outrider | Minerva Technologies",
  },
};
