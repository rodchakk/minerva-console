import { NextResponse } from "next/server";

export const dynamic = "force-static";

const manifest = {
  name: "Minerva Field",
  short_name: "Field",
  description: "Mobile field surface for Minerva operations.",
  id: "/field",
  start_url: "/field",
  scope: "/field/",
  display: "standalone",
  background_color: "#141414",
  theme_color: "#141414",
  icons: [
    {
      src: "/icons/minerva-field-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/minerva-field-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any maskable",
    },
  ],
};

export function GET() {
  return NextResponse.json(manifest, {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": "application/manifest+json",
    },
  });
}
