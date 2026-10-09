import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CommunityUnitDetailWorkspace } from "@/features/entry/communities/CommunityUnitDetailWorkspace";
import { getCommunityUnitDetailPageData } from "@/features/entry/communities/detailQueries";
import { getUsersLastSignIn } from "@/features/entry/users/lastSignIn";

function getUnitTypeLabel(label: string) {
  const normalized = label.trim().toLowerCase();
  if (normalized === "casas") return "Casa";
  if (normalized === "condominios") return "Condo";
  if (normalized === "apartamentos") return "Apto";
  if (normalized === "oficinas") return "Oficina";
  return label.trim() || "Unit";
}

function formatUnitDisplayLabel(label: string, unitType: string) {
  const trimmedLabel = label.trim();
  const trimmedType = getUnitTypeLabel(unitType);

  if (!trimmedLabel) return trimmedType;
  if (trimmedLabel.toLowerCase().includes(trimmedType.toLowerCase())) {
    return trimmedLabel;
  }

  return `${trimmedType} ${trimmedLabel}`.trim();
}

export default async function CommunityUnitDetailPage(
  props: PageProps<"/products/entry/communities/[communityId]/units/[unitId]">,
) {
  const { communityId, unitId } = await props.params;
  const searchParams = await props.searchParams;
  const data = await getCommunityUnitDetailPageData(communityId, unitId);

  if (!data.community) notFound();

  const community = data.community;

  if (data.state !== "unavailable" && !data.unit) notFound();

  if (data.state === "unavailable" || !data.unit) {
    return (
      <div className="-mx-4 -my-4 min-h-[calc(100vh-4rem)] bg-[#2E2936] px-4 py-4 text-[#E7E5EA] lg:-mx-6 lg:-my-5 lg:px-6 lg:py-5 2xl:-mx-7 2xl:px-7">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#BEB4FF]">
              ENTRY · UNIT DETAILS
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white">
              Unit unavailable
            </h1>
            <p className="mt-2 text-sm text-[#A9A3B2]">
              The unit directory could not be loaded right now.
            </p>
          </div>

          <Link
            href={`/products/entry/communities/${community.id}/units`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[7px] border border-[#141119] bg-[#2E2936] px-4 text-sm font-semibold text-white shadow-[0_2px_0_#141119]"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to directory
          </Link>
        </header>
      </div>
    );
  }

  const unit = data.unit;
  const lastSignInByUserId = await getUsersLastSignIn(
    unit.residents.map((resident) => resident.userId),
  );
  const unitTypeLabel = getUnitTypeLabel(community.unitLabel);
  const unitDisplayLabel = formatUnitDisplayLabel(
    unit.label,
    community.unitLabel,
  );

  return (
    <CommunityUnitDetailWorkspace
      communityId={community.id}
      communityName={community.name}
      houses={data.houses}
      initialFilter={
        typeof searchParams.status === "string" ? searchParams.status : undefined
      }
      initialQuery={
        typeof searchParams.q === "string" ? searchParams.q : undefined
      }
      lastSignInByUserId={lastSignInByUserId}
      unit={unit}
      unitDisplayLabel={unitDisplayLabel}
      unitTypeLabel={unitTypeLabel}
    />
  );
}
