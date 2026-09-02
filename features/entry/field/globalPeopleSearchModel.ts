export type ResidentCandidate = {
  communityId: string;
  communityName: string;
  email: string;
  houseId: string;
  houseLabel: string;
  isActive: boolean;
  name: string;
  userId: string;
  username: string;
};

export type ProfileCandidate = {
  authType: string;
  communityId: string;
  houseId: string;
  isActive: boolean;
  name: string;
  syntheticEmail: string;
  userId: string;
  username: string;
};

export type MembershipCandidate = {
  communityId: string;
  isActive: boolean;
  role: string;
  userId: string;
};

export function isResidentRole(role: string) {
  const normalized = role.trim().toUpperCase();

  return (
    normalized === "ADMIN" ||
    normalized === "GUARD" ||
    normalized === "RESIDENT" ||
    normalized === "UNASSIGNED"
  );
}

export function keyFor(communityId: string, userId: string) {
  return `${communityId}::${userId}`;
}

export function mergeResidents(
  rpcResidents: ResidentCandidate[],
  profileResidents: ProfileCandidate[],
  memberships: MembershipCandidate[],
) {
  const membershipByKey = new Map(
    memberships.map((membership) => [
      keyFor(membership.communityId, membership.userId),
      membership,
    ]),
  );
  const merged = new Map<string, ResidentCandidate>();

  for (const resident of rpcResidents) {
    merged.set(keyFor(resident.communityId, resident.userId), resident);
  }

  for (const profile of profileResidents) {
    const membership = membershipByKey.get(
      keyFor(profile.communityId, profile.userId),
    );

    if (!membership || !isResidentRole(membership.role)) {
      continue;
    }

    const existing = merged.get(keyFor(profile.communityId, profile.userId));

    merged.set(keyFor(profile.communityId, profile.userId), {
      communityId: profile.communityId,
      communityName: existing?.communityName ?? "",
      email: existing?.email || profile.syntheticEmail,
      houseId: existing?.houseId || profile.houseId,
      houseLabel: existing?.houseLabel || "No unit linked",
      isActive: existing?.isActive ?? membership.isActive ?? profile.isActive,
      name: existing?.name || profile.name,
      userId: profile.userId,
      username: existing?.username || profile.username,
    });
  }

  return Array.from(merged.values());
}
