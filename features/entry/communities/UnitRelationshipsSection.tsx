import "server-only";
import { UnitRelationshipsPanel } from "@/features/entry/communities/UnitRelationshipsPanel";
import { getUnitRelationshipsAction } from "@/features/entry/communities/unitRelationshipActions";

export async function UnitRelationshipsSection({ communityId, unitId, unitLabel }: { communityId: string; unitId: string; unitLabel: string }) {
  const result = await getUnitRelationshipsAction(communityId, unitId);
  if (result.error) return <p role="alert">{result.error}</p>;
  if (!result.enabled) return null;
  const { units, people, peopleHasMore, links, responsibilities, selectorError } = result;
  return <UnitRelationshipsPanel communityId={communityId} unitId={unitId} unitLabel={unitLabel} units={units} people={people} peopleHasMore={peopleHasMore} links={links} responsibilities={responsibilities} selectorError={selectorError} />;
}
