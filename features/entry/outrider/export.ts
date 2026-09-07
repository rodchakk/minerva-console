import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  OUTRIDER_STORAGE_BUCKET,
  getOutriderUnitTypeLabel,
  sanitizeOutriderFilename,
  type OutriderExportSummary,
} from "@/features/entry/outrider/model";
import { getOutriderDetail, type OutriderDetail } from "@/features/entry/outrider/queries";

type PortableOutriderExportSummary = Omit<
  OutriderExportSummary,
  "attachments" | "unitProfile"
> & {
  attachments: Array<
    Omit<OutriderExportSummary["attachments"][number], "storagePath">
  >;
  unitProfile: OutriderExportSummary["unitProfile"] & {
    namingExample: string | null;
  };
};

const OUTRIDER_EXPORT_STORAGE_BUCKET = "entry-outrider-exports";
const OUTRIDER_EXPORT_MAX_INPUT_BYTES = 95 * 1024 * 1024;
const OUTRIDER_EXPORT_SIGNED_URL_SECONDS = 10 * 60;
const ZIP_EPOCH = new Date("1980-01-01T00:00:00Z").getTime();

export class OutriderExportTooLargeError extends Error {
  constructor() {
    super("Outrider package exceeds the 95 MB export limit.");
    this.name = "OutriderExportTooLargeError";
  }
}

function dosDateTime(date = new Date()) {
  const safeDate = new Date(Math.max(date.getTime(), ZIP_EPOCH));
  const year = safeDate.getFullYear();
  const month = safeDate.getMonth() + 1;
  const day = safeDate.getDate();
  const hours = safeDate.getHours();
  const minutes = safeDate.getMinutes();
  const seconds = Math.floor(safeDate.getSeconds() / 2);

  return {
    date: ((year - 1980) << 9) | (month << 5) | day,
    time: (hours << 11) | (minutes << 5) | seconds,
  };
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUInt16(value: number) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function writeUInt32(value: number) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

function zipEntry(path: string, content: Uint8Array) {
  const name = Buffer.from(path, "utf8");
  const checksum = crc32(content);
  const { date, time } = dosDateTime();

  const localHeader = Buffer.concat([
    writeUInt32(0x04034b50),
    writeUInt16(20),
    writeUInt16(0x0800),
    writeUInt16(0),
    writeUInt16(time),
    writeUInt16(date),
    writeUInt32(checksum),
    writeUInt32(content.byteLength),
    writeUInt32(content.byteLength),
    writeUInt16(name.byteLength),
    writeUInt16(0),
    name,
  ]);

  const centralHeader = Buffer.concat([
    writeUInt32(0x02014b50),
    writeUInt16(20),
    writeUInt16(20),
    writeUInt16(0x0800),
    writeUInt16(0),
    writeUInt16(time),
    writeUInt16(date),
    writeUInt32(checksum),
    writeUInt32(content.byteLength),
    writeUInt32(content.byteLength),
    writeUInt16(name.byteLength),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt32(0),
    writeUInt32(0),
    name,
  ]);

  return {
    centralHeader,
    localHeader: Buffer.concat([localHeader, Buffer.from(content)]),
  };
}

function buildZip(entries: Array<{ content: Uint8Array; path: string }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const built = zipEntry(entry.path, entry.content);
    const patchedCentralHeader = Buffer.from(built.centralHeader);
    patchedCentralHeader.writeUInt32LE(offset >>> 0, 42);

    localParts.push(built.localHeader);
    centralParts.push(patchedCentralHeader);
    offset += built.localHeader.byteLength;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.concat([
    writeUInt32(0x06054b50),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(entries.length),
    writeUInt16(entries.length),
    writeUInt32(centralDirectory.byteLength),
    writeUInt32(offset),
    writeUInt16(0),
  ]);

  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
}

function textBytes(value: string) {
  return new TextEncoder().encode(value);
}

function makeUniquePath(basePath: string, used: Set<string>) {
  if (!used.has(basePath)) {
    used.add(basePath);
    return basePath;
  }

  const dot = basePath.lastIndexOf(".");
  const stem = dot > -1 ? basePath.slice(0, dot) : basePath;
  const extension = dot > -1 ? basePath.slice(dot) : "";

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${stem}-${index}${extension}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }

  throw new Error("Could not allocate a unique ZIP path.");
}

function assertExportSize(detail: OutriderDetail) {
  const sourceBytes = detail.files.reduce(
    (total, file) => total + Math.max(0, file.byteSize),
    0,
  );

  if (sourceBytes > OUTRIDER_EXPORT_MAX_INPUT_BYTES) {
    throw new OutriderExportTooLargeError();
  }
}

export function buildOutriderSummary(
  detail: OutriderDetail,
): PortableOutriderExportSummary {
  return {
    attachments: detail.files.map((file) => ({
      byteSize: file.byteSize,
      category: file.category,
      filename: file.originalFilename,
      mimeType: file.mimeType,
    })),
    community: {
      city: detail.communityCity === "Not set" ? null : detail.communityCity,
      id: detail.communityId,
      name: detail.communityName,
    },
    contact: {
      email: detail.contactEmail,
      name: detail.contactName,
      phone: detail.contactPhone,
    },
    destinations: {
      hasDestinations: detail.hasDestinations,
      names: detail.destinationNames,
    },
    inactiveUnits: {
      hasInactiveUnits: detail.hasInactiveUnits,
      notes: detail.inactiveUnitNotes,
    },
    metadata: {
      approvedAt: detail.approvedAt,
      generatedAt: new Date().toISOString(),
      progressPercent: detail.progressPercent,
      schemaVersion: "entry-outrider-export-v1",
      status: detail.status,
      submittedAt: detail.submittedAt,
    },
    reviewNote: detail.reviewNote,
    securityStaff: {
      count: detail.securityStaffCount,
      notes: detail.securityStaffNotes,
    },
    setupBoundary:
      "No live ENTRY operational records are automatically imported by Outrider.",
    unitProfile: {
      namingExample: detail.unitNamingExample,
      otherUnitType: detail.otherUnitType,
      types: detail.unitTypes,
    },
  };
}

export function buildOutriderMarkdown(summary: PortableOutriderExportSummary) {
  const unitTypes = summary.unitProfile.types
    .map(getOutriderUnitTypeLabel)
    .join(", ");
  const destinations =
    summary.destinations.names.length > 0
      ? summary.destinations.names.map((name) => `- ${name}`).join("\n")
      : "- None provided";
  const attachments =
    summary.attachments.length > 0
      ? summary.attachments
          .map(
            (file) =>
              `- ${file.category}: ${file.filename} (${Math.round(file.byteSize / 1024)} KB)`,
          )
          .join("\n")
      : "- No attachments";

  return [
    `# ENTRY Outrider Handoff - ${summary.community.name}`,
    "",
    summary.setupBoundary,
    "",
    "## Community",
    `- Name: ${summary.community.name}`,
    `- City: ${summary.community.city ?? "Not provided"}`,
    "",
    "## Status",
    `- Status: ${summary.metadata.status}`,
    `- Progress: ${summary.metadata.progressPercent}%`,
    `- Submitted: ${summary.metadata.submittedAt ?? "Not submitted"}`,
    `- Approved: ${summary.metadata.approvedAt ?? "Not approved"}`,
    "",
    "## Unit Profile",
    `- Types: ${unitTypes || "Not provided"}`,
    `- Naming example: ${summary.unitProfile.namingExample ?? "Not provided"}`,
    `- Other: ${summary.unitProfile.otherUnitType ?? "None"}`,
    "",
    "## Destinations",
    `- Has destinations: ${String(summary.destinations.hasDestinations)}`,
    destinations,
    "",
    "## Inactive Units",
    `- Has inactive units: ${String(summary.inactiveUnits.hasInactiveUnits)}`,
    `- Notes: ${summary.inactiveUnits.notes ?? "None"}`,
    "",
    "## Security Staff",
    `- Count: ${summary.securityStaff.count ?? "Not provided"}`,
    `- Notes: ${summary.securityStaff.notes ?? "None"}`,
    "",
    "## Contact",
    `- Name: ${summary.contact.name ?? "Not provided"}`,
    `- Phone: ${summary.contact.phone ?? "Not provided"}`,
    `- Email: ${summary.contact.email ?? "Not provided"}`,
    "",
    "## Attachments",
    attachments,
    "",
    "## Review Note",
    summary.reviewNote ?? "None",
    "",
  ].join("\n");
}

export async function getOutriderJsonExport(outriderId: string) {
  const detail = await getOutriderDetail(outriderId);
  return detail ? buildOutriderSummary(detail) : null;
}

export async function getOutriderZipExport(outriderId: string) {
  const detail = await getOutriderDetail(outriderId);
  if (!detail) return null;

  assertExportSize(detail);

  const summary = buildOutriderSummary(detail);
  const entries: Array<{ content: Uint8Array; path: string }> = [
    {
      content: textBytes(JSON.stringify(summary, null, 2)),
      path: "outrider-summary.json",
    },
    {
      content: textBytes(buildOutriderMarkdown(summary)),
      path: "summary.md",
    },
  ];
  const usedPaths = new Set(entries.map((entry) => entry.path));
  const supabase = createAdminClient();

  for (const file of detail.files) {
    const { data, error } = await supabase.storage
      .from(OUTRIDER_STORAGE_BUCKET)
      .download(file.storagePath);

    if (error || !data) {
      throw new Error(`Outrider attachment unavailable: ${file.id}`);
    }

    const bytes = new Uint8Array(await data.arrayBuffer());
    const safeFilename = sanitizeOutriderFilename(file.originalFilename);
    const path = makeUniquePath(
      `attachments/${file.category}/${safeFilename}`,
      usedPaths,
    );
    entries.push({ content: bytes, path });
  }

  const filename = `${sanitizeOutriderFilename(detail.communityName)}-outrider-handoff.zip`;
  const storagePath = `${detail.id}/${filename}`;
  const zipBytes = buildZip(entries);

  if (zipBytes.byteLength > 100 * 1024 * 1024) {
    throw new OutriderExportTooLargeError();
  }

  const { error: uploadError } = await supabase.storage
    .from(OUTRIDER_EXPORT_STORAGE_BUCKET)
    .upload(storagePath, zipBytes, {
      cacheControl: "0",
      contentType: "application/zip",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Could not stage Outrider package: ${uploadError.message}`);
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from(OUTRIDER_EXPORT_STORAGE_BUCKET)
    .createSignedUrl(storagePath, OUTRIDER_EXPORT_SIGNED_URL_SECONDS, {
      download: true,
    });

  if (signedError || !signedData?.signedUrl) {
    throw new Error("Could not sign Outrider package download.");
  }

  return {
    downloadUrl: signedData.signedUrl,
    filename,
  };
}
