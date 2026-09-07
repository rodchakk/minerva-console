import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const consoleTitle = "Minerva Console";
const consoleDescription = "Internal global console for Minerva Technologies.";
const consoleUrl = "https://console.minervatechs.com";
const consoleBrandImage = "/minerva-logo-transparent.png";

export const metadata: Metadata = {
  metadataBase: new URL(consoleUrl),
  title: consoleTitle,
  description: consoleDescription,
  icons: {
    icon: consoleBrandImage,
    shortcut: consoleBrandImage,
    apple: consoleBrandImage,
  },
  openGraph: {
    type: "website",
    url: consoleUrl,
    siteName: consoleTitle,
    title: consoleTitle,
    description: consoleDescription,
    images: [consoleBrandImage],
  },
  twitter: {
    card: "summary",
    title: consoleTitle,
    description: consoleDescription,
    images: [consoleBrandImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--app-bg)] text-slate-900">
        {children}
      </body>
    </html>
  );
}
