export type FieldCommunityListItem = {
  city: string;
  href: string;
  id: string;
  isActive: boolean;
  name: string;
  statusLabel: string;
  totalMembers: number;
  totalUnits: number;
};

export function filterFieldCommunities(
  communities: FieldCommunityListItem[],
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return communities;
  }

  return communities.filter((community) => {
    const searchableText = `${community.name} ${community.city}`.toLowerCase();
    return searchableText.includes(normalizedQuery);
  });
}
