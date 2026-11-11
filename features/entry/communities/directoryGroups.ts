export type GroupUnit = { id: string; label: string };
export type GroupLink = { unit_a_id: string; unit_b_id: string };

export function linkedGroups(units: GroupUnit[], links: GroupLink[]) {
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const adjacency = new Map(units.map((unit) => [unit.id, new Set<string>()]));

  for (const link of links) {
    if (!byId.has(link.unit_a_id) || !byId.has(link.unit_b_id)) continue;
    adjacency.get(link.unit_a_id)?.add(link.unit_b_id);
    adjacency.get(link.unit_b_id)?.add(link.unit_a_id);
  }

  const names = new Map<string, string>();
  const seen = new Set<string>();
  for (const unit of units) {
    if (seen.has(unit.id)) continue;
    const queue = [unit.id];
    const members: GroupUnit[] = [];
    seen.add(unit.id);
    for (let index = 0; index < queue.length; index += 1) {
      const currentId = queue[index];
      const current = byId.get(currentId);
      if (current) members.push(current);
      for (const nextId of adjacency.get(currentId) ?? []) {
        if (seen.has(nextId)) continue;
        seen.add(nextId);
        queue.push(nextId);
      }
    }
    if (members.length < 2) continue;
    // A suffix (#02, #3) identifies an independent unit, not a second building.
    // Use an explicitly existing unsuffixed label as the common name.
    const buildingNames = Array.from(new Set(members
      .map((item) => item.label.trim())
      .filter((label) => /^(?:apartamentos|edificio|condominio|residencial)\b/i.test(label))
      .filter((label) => !/\s+#\s*\d+$/u.test(label))
    )).sort((a, b) => a.localeCompare(b, "es"));
    const neutralAnchor = members
      .map((item) => item.label.trim())
      .sort((a, b) => a.localeCompare(b, "es"))[0];
    // Links connect independent units, not a canonical building record.
    // Never choose an arbitrary winner if several possible group names exist.
    const name = buildingNames.length === 1
      ? buildingNames[0]
      : "Conjunto por confirmar (" + neutralAnchor + ")";
    for (const member of members) names.set(member.id, name);
  }
  return names;
}

