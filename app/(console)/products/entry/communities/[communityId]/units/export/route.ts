import { NextResponse } from "next/server";
import { buildDirectoryExcel } from "@/features/entry/communities/directoryExcel";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getCommunityWithProgress } from "@/features/entry/communities/queries";
import { getCommunityDirectoryExport, type DirectoryUnit } from "@/features/entry/communities/directoryExportQueries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Unit = DirectoryUnit;
type Link = { unit_a_id: string; unit_b_id: string };

function unitType(label: string) {
  if (/^(?:apto\.?|apartamento\b|apartamentos\b)/i.test(label.trim())) return "Apartamento";
  if (/^(?:casa\b|vivienda\b)/i.test(label.trim())) return "Casa";
  if (/^(?:negocio\b|local comercial\b)/i.test(label.trim())) return "Negocio";
  // A commercial name or number alone is not sufficient evidence to assign a type.
  return "Por confirmar";
}

function linkedGroups(units: Unit[], links: Link[]) {
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
    const members: Unit[] = [];
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

function safeFilename(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 55) || "comunidad";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ communityId: string }> },
) {
  await requireSuperadmin();
  const { communityId } = await context.params;
  const community = await getCommunityWithProgress(communityId);
  if (!community) {
    return NextResponse.json({ error: "Community not found" }, { status: 404 });
  }

  let directory: Awaited<ReturnType<typeof getCommunityDirectoryExport>>;
  try {
    directory = await getCommunityDirectoryExport(communityId);
  } catch (error) {
    console.error("[entry-directory-export] required source unavailable", {
      communityId,
      reason: error instanceof Error ? error.message : "Unknown read failure",
    });
    return NextResponse.json({ error: "Directory temporarily unavailable" }, { status: 503 });
  }

  const groups = linkedGroups(directory.units, directory.links);
  const rows = directory.units.map((unit) => {
    const reference = [unit.publicReference, unit.unitReference]
      .map((value) => value.trim()).filter(Boolean);
    const activeNames = Array.from(new Set(
      unit.residents.filter((resident) => resident.isActive)
        .map((resident) => resident.fullName.trim()).filter(Boolean),
    ));
    return {
      type: unitType(unit.label),
      label: unit.label,
      group: groups.get(unit.id) || "—",
      reference: reference.length ? reference.join(" · ") : "Sin referencia registrada",
      residents: activeNames.length ? activeNames.join("; ") : "Sin residente registrado",
    };
  }).sort((a, b) =>
    a.group.localeCompare(b.group, "es") ||
    a.type.localeCompare(b.type, "es") ||
    a.label.localeCompare(b.label, "es", { numeric: true })
  );

  const values: [string, string, string, string, string, string, string][] = rows.map((row) => [
    row.type, row.label, row.group,
    row.reference, row.residents, "Por revisar", "",
  ]);
  const bytes = buildDirectoryExcel(community.name, new Date(), values);
  const filename = "Directorio_" + safeFilename(community.name) + ".xlsx";

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=\"" + filename + "\"",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
