import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getCommunityWithProgress } from "@/features/entry/communities/queries";
import { getCommunityUnitsPageData } from "@/features/entry/communities/detailQueries";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = [
  "Tipo",
  "Unidad / negocio",
  "Conjunto / edificio",
  "Referencia para ubicar",
  "Residentes / contacto",
  "Revisión",
  "Corrección",
] as const;

type Unit = Awaited<ReturnType<typeof getCommunityUnitsPageData>>["items"][number];
type Link = { unit_a_id: string; unit_b_id: string };

function plainText(value: string) {
  // Avoid interpreting untrusted labels and names as spreadsheet formulas.
  return /^[=+@\-\t\r]/.test(value) ? "'" + value : value;
}

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
    const explicitBuilding = members
      .map((item) => item.label.trim())
      .filter((label) => /^(?:apartamentos|edificio|condominio|residencial)\b/i.test(label))
      .sort((a, b) => a.localeCompare(b, "es"))[0];
    const neutralAnchor = members
      .map((item) => item.label.trim())
      .sort((a, b) => a.localeCompare(b, "es"))[0];
    const name = explicitBuilding || "Conjunto por confirmar (" + neutralAnchor + ")";
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

  const supabase = await createClient();
  const [directory, linkResult] = await Promise.all([
    getCommunityUnitsPageData({ communityId }),
    supabase.from("entry_unit_links")
      .select("unit_a_id,unit_b_id")
      .eq("community_id", communityId)
      .is("ended_at", null),
  ]);

  if (directory.state === "unavailable" || linkResult.error) {
    // Fail closed. An incomplete export might falsely show units as unlinked.
    console.error("[entry-directory-export] source unavailable", {
      communityId, linkErrorCode: linkResult.error?.code ?? null,
      directoryState: directory.state,
    });
    return NextResponse.json({ error: "Directory temporarily unavailable" }, { status: 503 });
  }

  const groups = linkedGroups(directory.items, (linkResult.data ?? []) as Link[]);
  const rows = directory.items.map((unit) => {
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

  const values: string[][] = [
    ["Directorio de " + community.name],
    ["Generado: " + new Intl.DateTimeFormat("es-HN", { dateStyle: "long", timeZone: "America/Tegucigalpa" }).format(new Date())],
    ["Revisión: seleccione Por revisar, Correcto o Corregir. Anote el cambio solicitado en Corrección."],
    [],
    [...HEADERS],
    ...rows.map((row) => [
      row.type, row.label, row.group, row.reference,
      row.residents, "Por revisar", "",
    ].map(plainText)),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(values);
  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
  ];
  worksheet["!cols"] = [17, 29, 39, 40, 44, 18, 48].map((wch) => ({ wch }));
  worksheet["!autofilter"] = { ref: "A5:G" + Math.max(5, values.length) };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Directorio");
  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true });
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
