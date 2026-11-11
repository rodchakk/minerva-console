import { NextResponse } from "next/server";
import { buildDirectoryExcel } from "@/features/entry/communities/directoryExcel";
import { linkedGroups } from "@/features/entry/communities/directoryGroups";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getCommunityWithProgress } from "@/features/entry/communities/queries";
import { getCommunityDirectoryExport } from "@/features/entry/communities/directoryExportQueries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unitType(label: string) {
  if (/^(?:apto\.?|apartamento\b|apartamentos\b)/i.test(label.trim())) return "Apartamento";
  if (/^(?:casa\b|vivienda\b)/i.test(label.trim())) return "Casa";
  if (/^(?:negocio\b|local comercial\b)/i.test(label.trim())) return "Negocio";
  // A commercial name or number alone is not sufficient evidence to assign a type.
  return "Por confirmar";
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
