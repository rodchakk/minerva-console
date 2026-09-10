import type { Metadata, Viewport } from "next";
import { FieldShell } from "@/components/field/FieldShell";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryDeploymentBoundary } from "@/features/entry/deploymentBoundary";
import { getFieldActiveWorkTimer } from "@/features/entry/field/workTimerData";

export const metadata: Metadata = {
  title: "Minerva Field",
  description: "Mobile field surface for Minerva operations.",
  manifest: "/field/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "Field",
  },
};

export const viewport: Viewport = {
  themeColor: "#141414",
};

export default async function FieldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireSuperadmin();
  const boundary = getEntryDeploymentBoundary();
  const activeWorkTimer = await getFieldActiveWorkTimer(user.id);

  return (
    <FieldShell
      activeWorkTimer={activeWorkTimer}
      email={user.email}
      previewReadOnly={boundary.previewReadOnly}
    >
      {children}
    </FieldShell>
  );
}
