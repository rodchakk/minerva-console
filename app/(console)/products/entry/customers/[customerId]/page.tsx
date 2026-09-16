import { redirect } from "next/navigation";

export default async function LegacyEntryCustomerPage(props: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await props.params;
  redirect(`/customers/${customerId}`);
}
