import { Shell } from "@/components/layout/Shell";
import { requireConsoleOwner } from "@/features/auth/consoleAccess";
import { getEntryDeploymentBoundary } from "@/features/entry/deploymentBoundary";

export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireConsoleOwner();
  const boundary = getEntryDeploymentBoundary();

  return (
    <Shell email={user.email} previewReadOnly={boundary.previewReadOnly}>
      {children}
    </Shell>
  );
}
