import { redirect } from "next/navigation";

type FieldActivationPageProps = {
  params: Promise<{ communityId: string }>;
};

export default async function FieldActivationPage({
  params,
}: FieldActivationPageProps) {
  const { communityId } = await params;
  redirect(`/field/entry/communities/${encodeURIComponent(communityId)}/people`);
}
