import { requireConsoleOwner } from "@/features/auth/consoleAccess";
import { SecurityWatchWorkspace } from "@/features/security-watch/SecurityWatchWorkspace";
import { readSecurityWatchState } from "@/features/security-watch/store";

export const dynamic = "force-dynamic";

export default async function SecurityWatchPage() {
  // Access remains inside the existing protected Minerva Console owner workspace.
  await requireConsoleOwner();
  const data = await readSecurityWatchState();
  return <SecurityWatchWorkspace {...data} />;
}
