import { OutriderWorkspace } from "@/features/entry/outrider/internal/OutriderWorkspace";
import {
  listCommunitiesAvailableForOutrider,
  listOutriderSessions,
} from "@/features/entry/outrider/queries";

export const dynamic = "force-dynamic";

export default async function EntryOutriderPage() {
  const [sessions, communities] = await Promise.all([
    listOutriderSessions(),
    listCommunitiesAvailableForOutrider(),
  ]);

  return <OutriderWorkspace communities={communities} sessions={sessions} />;
}
