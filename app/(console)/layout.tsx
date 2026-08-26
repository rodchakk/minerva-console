import { Shell } from "@/components/layout/Shell";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryDeploymentBoundary } from "@/features/entry/deploymentBoundary";

export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireSuperadmin();
  const boundary = getEntryDeploymentBoundary();

  return (
    <Shell email={user.email} previewReadOnly={boundary.previewReadOnly}>
      {children}
    </Shell>
  );
}
