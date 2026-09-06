"use server";

import { revalidatePath } from "next/cache";
import { setCommunityUnitActiveStatusAction } from "@/features/entry/communities/unitActions";

export type FieldUnitStatusResult = {
  error?: string;
  success: boolean;
};

export async function setFieldUnitActiveStatus(input: {
  communityId: string;
  isActive: boolean;
  unitId: string;
}): Promise<FieldUnitStatusResult> {
  const result = await setCommunityUnitActiveStatusAction(input);

  if (!result.success) {
    return result;
  }

  revalidatePath(`/field/entry/communities/${input.communityId}`);
  revalidatePath(`/field/entry/communities/${input.communityId}/people`);
  revalidatePath(
    `/field/entry/communities/${input.communityId}/people/units/${input.unitId}`,
  );

  return { success: true };
}
