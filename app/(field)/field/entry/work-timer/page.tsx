import { FieldWorkTimerWorkspace } from "@/features/entry/field/FieldWorkTimerWorkspace";
import { getFieldWorkTimerPageData } from "@/features/entry/field/workTimerData";
import { isEntryPreviewReadOnly } from "@/features/entry/deploymentBoundary";

type FieldEntryWorkTimerPageProps = {
  searchParams: Promise<{
    month?: string | string[];
  }>;
};

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FieldEntryWorkTimerPage({
  searchParams,
}: FieldEntryWorkTimerPageProps) {
  const params = await searchParams;
  const data = await getFieldWorkTimerPageData(getSearchParam(params.month));

  return (
    <FieldWorkTimerWorkspace
      data={data}
      isReadOnlyPreview={isEntryPreviewReadOnly()}
    />
  );
}
