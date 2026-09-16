import { redirect } from "next/navigation";

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function LegacyEntryNewCustomerPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const communityId = getSingleParam(searchParams.community_id);

  redirect(communityId ? `/customers/new?community_id=${encodeURIComponent(communityId)}` : "/customers/new");
}
