"use server";

import { getActivationQueuePageData, type ActivationQueueRow } from "@/features/entry/activation/actions";

export type ActivationResidentLookupResult =
  | { success: true; row: ActivationQueueRow }
  | { success: false; error: string };

// This reuses the exact superadmin-gated read model used by Activation Queue.
// Never expose activation PIN material or trust community/queue identity from the client.
export async function getActivationResidentForUsersAction(
  communityId: string,
  queueId: string,
): Promise<ActivationResidentLookupResult> {
  if (!communityId || !queueId) {
    return { success: false, error: "Select a valid activation record." };
  }

  const page = await getActivationQueuePageData({ communityId });
  const row = page.rows.find((candidate) => candidate.id === queueId);

  if (!row) {
    return { success: false, error: "Activation record was not found or is no longer available." };
  }

  return { success: true, row };
}
