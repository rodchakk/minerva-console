import { redirect } from "next/navigation";

export default async function LegacyEntryEditCustomerPage(props: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await props.params;
  redirect(`/customers/${customerId}/edit`);
}
