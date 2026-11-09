import { requireConsoleOwner } from "@/features/auth/consoleAccess";
import { SecurityWatchWorkspace } from "@/features/security-watch/SecurityWatchWorkspace";
import { readSecurityWatchState } from "@/features/security-watch/store";

export const dynamic = "force-dynamic";

export default async function SecurityWatchPage() {
  // Access remains inside the existing protected Minerva Console owner workspace.
  await requireConsoleOwner();
  const data = await readSecurityWatchState();
  const ingestConfigured = (process.env.SECURITY_WATCH_INGEST_TOKEN?.length ?? 0) >= 32;
  const notificationsConfigured = Boolean(
    process.env.RESEND_API_KEY && process.env.SECURITY_WATCH_ALERT_FROM &&
    process.env.SECURITY_WATCH_ALERT_TO
  );
  return <SecurityWatchWorkspace {...data}
    ingestConfigured={ingestConfigured}
    notificationsConfigured={notificationsConfigured}
  />;
}
