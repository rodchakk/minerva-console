import type { Metadata, Viewport } from "next";
import { FieldShell } from "@/components/field/FieldShell";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryDeploymentBoundary } from "@/features/entry/deploymentBoundary";
import { getFieldActiveWorkTimer } from "@/features/entry/field/workTimerData";
import { getEntryObservability } from "@/features/entry/observability/queries";

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

  const [activeWorkTimer, healthResult] = await Promise.all([
    getFieldActiveWorkTimer(user.id),
    getEntryObservability({ range: "24h" }).catch(() => ({
      error: "ENTRY health unavailable",
      state: "unavailable" as const,
    })),
  ]);

  return (
    <FieldShell
      activeWorkTimer={activeWorkTimer}
      entryHealthStatus={
        healthResult.state === "ready"
          ? healthResult.data.summary.systemStatus
          : "unknown"
      }
      entryIncidentCount={
        healthResult.state === "ready" ? healthResult.data.incidents.length : 0
      }
      previewReadOnly={boundary.previewReadOnly}
    >
      {children}
    </FieldShell>
  );
}
