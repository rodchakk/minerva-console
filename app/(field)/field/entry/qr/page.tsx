import { FieldQuickQrWorkspace } from "@/features/entry/field/FieldQuickQrWorkspace";
import { getFieldQuickQrRegistrationOptions } from "@/features/entry/field/quickQrData";

export default async function FieldQuickQrPage() {
  const registrations = await getFieldQuickQrRegistrationOptions();

  return <FieldQuickQrWorkspace registrations={registrations} />;
}
