"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import {
  getEntryPreviewReadOnlyError,
  getResidentFacingBaseUrl,
} from "@/features/entry/deploymentBoundary";
import {
  decryptOutriderToken,
  encryptOutriderToken,
  hashOutriderToken,
  makeOutriderToken,
  timingSafeHashEqual,
} from "@/features/entry/outrider/token";
import { createAdminClient } from "@/lib/supabase/admin";
import { coerceString } from "@/lib/supabase/utils";
import {
  OUTRIDER_EXPORT_STORAGE_BUCKET,
  OUTRIDER_SETUP_WORKBOOK_CATEGORY,
  OUTRIDER_SETUP_WORKBOOK_MIME_TYPE,
  OUTRIDER_STORAGE_BUCKET,
  buildOutriderStoragePath,
  isAllowedOutriderFile,
} from "@/features/entry/outrider/model";
import { getOutriderDetail } from "@/features/entry/outrider/queries";
import {
  inputFingerprintHex,
  sha256Hex,
} from "@/features/entry/outrider/setupReport/fingerprint";
import {
  SETUP_REPORT_SCHEMA_VERSION,
  SETUP_WORKBOOK_SCHEMA_VERSION,
  type OutriderSetupReportAnalysis,
} from "@/features/entry/outrider/setupReport/model";
import { renderSetupReportPdf } from "@/features/entry/outrider/setupReport/pdf";
import {
  buildRelevantOutriderInput,
  buildSetupReportSnapshot,
  buildSetupReportSummary,
} from "@/features/entry/outrider/setupReport/reportSnapshot";
import { validateSetupWorkbook } from "@/features/entry/outrider/setupReport/validation";
import { parseSetupWorkbookBytes } from "@/features/entry/outrider/setupReport/workbook";

export type OutriderActionResult =
  | {
      data?: {
        analysis?: OutriderSetupReportAnalysis;
        link?: string;
        outriderId?: string;
        reportId?: string;
      };
      success: true;
    }
  | {
      code:
        | "conflict"
        | "invalid_input"
        | "invalid_state"
        | "link_unrecoverable"
        | "unauthorized"
        | "unknown";
      error: string;
      success: false;
    };

function getFormString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function mapActionError(error: { code?: string | null; message?: string | null }) {
  const text = error.message ?? "";

  if (error.code === "42501" || /UNAUTHORIZED|INVALID_ACTOR/i.test(text)) {
    return {
      code: "unauthorized" as const,
      error: "Access denied. Superadmin permission required.",
      success: false as const,
    };
  }

  if (/INVALID_COMMUNITY|INVALID_PAYLOAD/i.test(text)) {
    return {
      code: "invalid_input" as const,
      error: "Check the community information and try again.",
      success: false as const,
    };
  }

  if (error.code === "P0409" || /CONFLICT/.test(text)) {
    return {
      code: "conflict" as const,
      error: "This ENTRY community already has an Outrider intake.",
      success: false as const,
    };
  }

  if (/INVALID_STATE|READ_ONLY/.test(text)) {
    return {
      code: "invalid_state" as const,
      error: "This Outrider intake cannot be changed in its current status.",
      success: false as const,
    };
  }

  if (/SETUP_REPORT_REQUIRED|STALE|BLOCKING_FINDINGS|REPORT_UNAVAILABLE/.test(text)) {
    return {
      code: "invalid_state" as const,
      error:
        "Generate a current setup report without blocking errors before approval.",
      success: false as const,
    };
  }

  if (/APPROVED_LOCKED|GENERATION_IN_PROGRESS/.test(text)) {
    return {
      code: "invalid_state" as const,
      error:
        "This Outrider setup workflow is locked in its current state.",
      success: false as const,
    };
  }

  return {
    code: "unknown" as const,
    error: "Outrider could not complete the request. Please try again.",
    success: false as const,
  };
}

async function getSetupWorkbookSource(outriderId: string, sourceFileId?: string) {
  const detail = await getOutriderDetail(outriderId);
  const latestSource = detail?.latestSetupWorkbook ?? null;
  const source =
    sourceFileId && latestSource?.id !== sourceFileId ? null : latestSource;

  return { detail, latestSource, source: source ?? null };
}

async function downloadSetupWorkbookBytes(source: { storagePath: string }) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(OUTRIDER_STORAGE_BUCKET)
    .download(source.storagePath);

  if (error || !data) {
    throw new Error("SETUP_WORKBOOK_UNAVAILABLE");
  }

  return Buffer.from(await data.arrayBuffer());
}

function analyzeSetupWorkbookBytes(input: {
  bytes: Buffer;
  detail: NonNullable<Awaited<ReturnType<typeof getOutriderDetail>>>;
  source: NonNullable<Awaited<ReturnType<typeof getSetupWorkbookSource>>["source"]>;
}) {
  const sourceSha256 = sha256Hex(input.bytes);
  const parsed = parseSetupWorkbookBytes(input.bytes);
  const validation = validateSetupWorkbook(parsed.workbook, parsed.findings, {
    outriderCommunityName: input.detail.communityName,
  });
  const summary = parsed.workbook
    ? buildSetupReportSummary(parsed.workbook, validation)
    : {
        adminRows: 0,
        destinationRows: 0,
        residentCoveragePercent: null,
        residentRows: 0,
        units: 0,
        unitsMissingReferences: 0,
        unitsWithReferences: 0,
        warnings: validation.counts.warnings,
      };
  const currentInputSha256 = inputFingerprintHex({
    outrider: buildRelevantOutriderInput(input.detail),
    sourceSha256,
  });

  return {
    currentInputSha256,
    parsed,
    sourceSha256,
    summary,
    validation,
  };
}

export async function uploadSetupWorkbook(
  _previousState: OutriderActionResult | null,
  formData: FormData,
): Promise<OutriderActionResult> {
  const auth = await requireSuperadmin();
  const previewError = previewErrorResult();
  if (previewError) return previewError;

  const outriderId = getFormString(formData, "outrider_id");
  const file = formData.get("setup_workbook");

  if (!outriderId || !(file instanceof File)) {
    return {
      code: "invalid_input",
      error: "Choose an XLSX setup workbook to upload.",
      success: false,
    };
  }

  const detail = await getOutriderDetail(outriderId);
  if (!detail || detail.status === "approved") {
    return {
      code: "invalid_state",
      error: "This Outrider setup workflow is locked.",
      success: false,
    };
  }

  if (
    !isAllowedOutriderFile({
      byteSize: file.size,
      mimeType: file.type,
      originalFilename: file.name,
    }) ||
    file.type !== OUTRIDER_SETUP_WORKBOOK_MIME_TYPE ||
    !file.name.toLowerCase().endsWith(".xlsx")
  ) {
    return {
      code: "invalid_input",
      error: "Setup workbook must be an XLSX file up to 20 MB.",
      success: false,
    };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileSha256 = sha256Hex(bytes);
  const storagePath = buildOutriderStoragePath({
    category: OUTRIDER_SETUP_WORKBOOK_CATEGORY,
    filename: file.name,
    outriderId,
    uploadId: randomUUID(),
  });
  const supabase = createAdminClient();
  const { error: uploadError } = await supabase.storage
    .from(OUTRIDER_STORAGE_BUCKET)
    .upload(storagePath, bytes, {
      cacheControl: "0",
      contentType: OUTRIDER_SETUP_WORKBOOK_MIME_TYPE,
      upsert: false,
    });

  if (uploadError) {
    return {
      code: "unknown",
      error: "Could not store the setup workbook.",
      success: false,
    };
  }

  const { error } = await supabase.rpc(
    "record_community_outrider_setup_workbook_v1",
    {
      p_actor_user_id: auth.user.id,
      p_byte_size: file.size,
      p_file_sha256: fileSha256,
      p_mime_type: OUTRIDER_SETUP_WORKBOOK_MIME_TYPE,
      p_original_filename: file.name,
      p_outrider_id: outriderId,
      p_storage_path: storagePath,
    },
  );

  if (error) {
    await supabase.storage.from(OUTRIDER_STORAGE_BUCKET).remove([storagePath]);
    return mapActionError(error);
  }

  revalidatePath(`/products/entry/outrider/${outriderId}`);

  return {
    data: { outriderId },
    success: true,
  };
}

export async function analyzeSetupWorkbook(
  _previousState: OutriderActionResult | null,
  formData: FormData,
): Promise<OutriderActionResult> {
  await requireSuperadmin();

  const outriderId = getFormString(formData, "outrider_id");
  const sourceFileId = getFormString(formData, "source_file_id");
  if (!outriderId) {
    return {
      code: "invalid_input",
      error: "Outrider information is missing.",
      success: false,
    };
  }

  try {
  const { detail, latestSource, source } = await getSetupWorkbookSource(
    outriderId,
    sourceFileId || undefined,
  );
    if (!detail || !source || !latestSource) {
      return {
        code: "invalid_state",
        error: sourceFileId
          ? "Analyze the latest setup workbook before continuing."
          : "Upload a setup workbook before analysis.",
        success: false,
      };
    }

    const bytes = await downloadSetupWorkbookBytes(source);
    const analysis = analyzeSetupWorkbookBytes({ bytes, detail, source });

    return {
      data: {
        analysis: {
          currentInputSha256: analysis.currentInputSha256,
          findings: analysis.validation.findings,
          latestSourceFileId: latestSource.id,
          sourceFileId: source.id,
          sourceFilename: source.originalFilename,
          sourceSha256: analysis.sourceSha256,
          summary: analysis.summary,
        },
        outriderId,
      },
      success: true,
    };
  } catch {
    return {
      code: "invalid_state",
      error: "The setup workbook could not be analyzed.",
      success: false,
    };
  }
}

export async function generateSetupReport(
  _previousState: OutriderActionResult | null,
  formData: FormData,
): Promise<OutriderActionResult> {
  const auth = await requireSuperadmin();
  const previewError = previewErrorResult();
  if (previewError) return previewError;

  const outriderId = getFormString(formData, "outrider_id");
  const sourceFileId = getFormString(formData, "source_file_id");
  if (!outriderId) {
    return {
      code: "invalid_input",
      error: "Outrider information is missing.",
      success: false,
    };
  }

  try {
    const { detail, latestSource, source } = await getSetupWorkbookSource(
      outriderId,
      sourceFileId || undefined,
    );
    if (!detail || !source || !latestSource) {
      return {
        code: "invalid_state",
        error: sourceFileId
          ? "Regenerate analysis from the latest setup workbook."
          : "Upload a setup workbook before generating a report.",
        success: false,
      };
    }

    if (detail.status === "approved") {
      return {
        code: "invalid_state",
        error: "This Outrider setup workflow is locked.",
        success: false,
      };
    }

    const bytes = await downloadSetupWorkbookBytes(source);
    const analysis = analyzeSetupWorkbookBytes({ bytes, detail, source });
    if (!analysis.parsed.workbook || analysis.validation.hasBlockingErrors) {
      return {
        code: "invalid_state",
        error: "Resolve blocking workbook errors before generating a report.",
        success: false,
      };
    }

    const generatedAt = new Date().toISOString();
    const supabase = createAdminClient();
    const { data: reservation, error: reservationError } = await supabase.rpc(
      "prepare_community_outrider_setup_report_v1",
      {
        p_actor_user_id: auth.user.id,
        p_findings: analysis.validation.findings,
        p_input_sha256: analysis.currentInputSha256,
        p_parsed_snapshot: analysis.parsed.workbook,
        p_report_schema_version: SETUP_REPORT_SCHEMA_VERSION,
        p_source_file_id: source.id,
        p_source_sha256: analysis.sourceSha256,
        p_workbook_schema_version:
          analysis.parsed.workbook.schemaVersion ?? SETUP_WORKBOOK_SCHEMA_VERSION,
        p_outrider_id: outriderId,
      },
    );

    if (reservationError) return mapActionError(reservationError);

    const reserved = reservation as Record<string, unknown>;
    const reportId = coerceString(reserved.report_id);
    const reportVersion = Number(reserved.version);
    const pdfStoragePath = coerceString(reserved.pdf_storage_path);
    if (!reportId || !Number.isInteger(reportVersion) || !pdfStoragePath) {
      throw new Error("SETUP_REPORT_RESERVATION_INVALID");
    }

    const snapshot = buildSetupReportSnapshot({
      detail,
      generatedAt,
      source: {
        fileId: source.id,
        filename: source.originalFilename,
        sha256: analysis.sourceSha256,
        sha256Prefix: analysis.sourceSha256.slice(0, 12),
        uploadedAt: source.createdAt,
        versionLabel: `v${reportVersion}`,
      },
      validation: analysis.validation,
      workbook: analysis.parsed.workbook,
    });
    const pdfBytes = await renderSetupReportPdf(snapshot);

    const { error: pdfUploadError } = await supabase.storage
      .from(OUTRIDER_EXPORT_STORAGE_BUCKET)
      .upload(pdfStoragePath, pdfBytes, {
        cacheControl: "0",
        contentType: "application/pdf",
        upsert: false,
      });

    if (pdfUploadError) {
      await supabase.rpc("cancel_community_outrider_setup_report_generation_v1", {
        p_actor_user_id: auth.user.id,
        p_report_id: reportId,
      });
      throw new Error(pdfUploadError.message);
    }

    const { data, error } = await supabase.rpc(
      "finalize_community_outrider_setup_report_v1",
      {
        p_actor_user_id: auth.user.id,
        p_generated_at: generatedAt,
        p_report_id: reportId,
        p_report_schema_version: SETUP_REPORT_SCHEMA_VERSION,
        p_report_snapshot: snapshot,
        p_source_filename_snapshot: source.originalFilename,
      },
    );

    if (error) {
      await supabase.storage
        .from(OUTRIDER_EXPORT_STORAGE_BUCKET)
        .remove([pdfStoragePath]);
      await supabase.rpc("cancel_community_outrider_setup_report_generation_v1", {
        p_actor_user_id: auth.user.id,
        p_report_id: reportId,
      });
      return mapActionError(error);
    }

    revalidatePath("/products/entry");
    revalidatePath("/products/entry/outrider");
    revalidatePath(`/products/entry/outrider/${outriderId}`);

    return {
      data: {
        outriderId,
        reportId: coerceString((data as Record<string, unknown>)?.report_id),
      },
      success: true,
    };
  } catch {
    return {
      code: "unknown",
      error: "Could not generate the preliminary setup report.",
      success: false,
    };
  }
}

export async function approveSetupReport(
  _previousState: OutriderActionResult | null,
  formData: FormData,
): Promise<OutriderActionResult> {
  const auth = await requireSuperadmin();
  const previewError = previewErrorResult();
  if (previewError) return previewError;

  const outriderId = getFormString(formData, "outrider_id");
  const reportId = getFormString(formData, "report_id");
  if (!outriderId || !reportId) {
    return {
      code: "invalid_input",
      error: "Report information is missing.",
      success: false,
    };
  }

  const detail = await getOutriderDetail(outriderId);
  const report = detail?.currentSetupReport;
  if (
    !detail ||
    detail.status === "approved" ||
    !report ||
    report.id !== reportId ||
    report.isStale
  ) {
    return {
      code: "invalid_state",
      error: "Regenerate the current setup report before approval.",
      success: false,
    };
  }

  const currentInputSha256 = inputFingerprintHex({
    outrider: buildRelevantOutriderInput(detail),
    sourceSha256: report.sourceSha256,
  });
  const supabase = createAdminClient();
  const { error } = await supabase.rpc(
    "approve_community_outrider_setup_report_v1",
    {
      p_actor_user_id: auth.user.id,
      p_current_input_sha256: currentInputSha256,
      p_report_id: reportId,
    },
  );

  if (error) return mapActionError(error);

  revalidatePath("/products/entry");
  revalidatePath("/products/entry/outrider");
  revalidatePath(`/products/entry/outrider/${outriderId}`);

  return {
    data: { outriderId, reportId },
    success: true,
  };
}

function previewErrorResult(): OutriderActionResult | null {
  const error = getEntryPreviewReadOnlyError();
  return error
    ? {
        code: "unknown",
        error,
        success: false,
      }
    : null;
}

async function buildPublicOutriderUrl(token: string) {
  const baseUrl = await getResidentFacingBaseUrl();
  return `${baseUrl}/entry/outrider/${encodeURIComponent(token)}`;
}

function makeEncryptedTokenPayload() {
  const token = makeOutriderToken();
  return {
    encryptedTokenPayload: encryptOutriderToken(token),
    token,
    tokenHash: hashOutriderToken(token),
  };
}

export async function createOutriderSession(
  _previousState: OutriderActionResult | null,
  formData: FormData,
): Promise<OutriderActionResult> {
  const auth = await requireSuperadmin();
  const previewError = previewErrorResult();
  if (previewError) return previewError;

  const communityId = getFormString(formData, "community_id");
  const communityName = getFormString(formData, "community_name");
  const communityCity = getFormString(formData, "community_city");

  if (!communityId && !communityName) {
    return {
      code: "invalid_input",
      error: "Enter the community name before starting Outrider.",
      success: false,
    };
  }

  if (communityName.length > 180 || communityCity.length > 180) {
    return {
      code: "invalid_input",
      error: "Community name and city must be 180 characters or fewer.",
      success: false,
    };
  }

  let tokenPayload: ReturnType<typeof makeEncryptedTokenPayload>;
  try {
    tokenPayload = makeEncryptedTokenPayload();
  } catch {
    return {
      code: "unknown",
      error: "Outrider link encryption is not configured.",
      success: false,
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "create_community_outrider_session_v2",
    {
      p_actor_user_id: auth.user.id,
      p_community_city: communityCity || null,
      p_community_id: communityId || null,
      p_community_name: communityName || null,
      p_encrypted_token_payload: tokenPayload.encryptedTokenPayload,
      p_token_hash: tokenPayload.tokenHash,
    },
  );

  if (error) return mapActionError(error);

  const outriderId = coerceString((data as Record<string, unknown>)?.outrider_id);
  if (!outriderId) {
    return {
      code: "unknown",
      error: "Outrider was created, but its ID was not returned.",
      success: false,
    };
  }

  revalidatePath("/products/entry");
  revalidatePath("/products/entry/outrider");

  return {
    data: {
      link: await buildPublicOutriderUrl(tokenPayload.token),
      outriderId,
    },
    success: true,
  };
}

export async function rotateOutriderLink(
  _previousState: OutriderActionResult | null,
  formData: FormData,
): Promise<OutriderActionResult> {
  const auth = await requireSuperadmin();
  const previewError = previewErrorResult();
  if (previewError) return previewError;

  const outriderId = getFormString(formData, "outrider_id");
  if (!outriderId) {
    return {
      code: "invalid_input",
      error: "Outrider information is missing.",
      success: false,
    };
  }

  let tokenPayload: ReturnType<typeof makeEncryptedTokenPayload>;
  try {
    tokenPayload = makeEncryptedTokenPayload();
  } catch {
    return {
      code: "unknown",
      error: "Outrider link encryption is not configured.",
      success: false,
    };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("rotate_community_outrider_access_v1", {
    p_actor_user_id: auth.user.id,
    p_encrypted_token_payload: tokenPayload.encryptedTokenPayload,
    p_outrider_id: outriderId,
    p_token_hash: tokenPayload.tokenHash,
  });

  if (error) return mapActionError(error);

  revalidatePath("/products/entry/outrider");
  revalidatePath(`/products/entry/outrider/${outriderId}`);

  return {
    data: {
      link: await buildPublicOutriderUrl(tokenPayload.token),
      outriderId,
    },
    success: true,
  };
}

export async function recoverOutriderLink(input: {
  outriderId: string;
}): Promise<OutriderActionResult> {
  await requireSuperadmin();

  const outriderId = input.outriderId.trim();
  if (!outriderId) {
    return {
      code: "invalid_input",
      error: "Outrider information is missing.",
      success: false,
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("community_outrider_sessions")
    .select("id,token_hash,encrypted_token_payload,status")
    .eq("id", outriderId)
    .maybeSingle();

  if (error || !data) {
    return {
      code: "invalid_state",
      error: "This Outrider intake is not available.",
      success: false,
    };
  }

  const encryptedPayload = coerceString(data.encrypted_token_payload);
  const storedHash = coerceString(data.token_hash);
  if (!encryptedPayload || !storedHash) {
    return {
      code: "link_unrecoverable",
      error: "This Outrider link cannot be recovered. Rotate the link once.",
      success: false,
    };
  }

  try {
    const token = decryptOutriderToken(encryptedPayload);
    const tokenHash = hashOutriderToken(token);

    if (!timingSafeHashEqual(tokenHash, storedHash)) {
      throw new Error("Outrider token hash mismatch.");
    }

    return {
      data: {
        link: await buildPublicOutriderUrl(token),
        outriderId,
      },
      success: true,
    };
  } catch {
    return {
      code: "unknown",
      error: "Could not recover this Outrider link. Rotate it if needed.",
      success: false,
    };
  }
}

export async function requestOutriderInformation(
  _previousState: OutriderActionResult | null,
  formData: FormData,
): Promise<OutriderActionResult> {
  const auth = await requireSuperadmin();
  const previewError = previewErrorResult();
  if (previewError) return previewError;

  const outriderId = getFormString(formData, "outrider_id");
  const note = getFormString(formData, "review_note");

  if (!outriderId || !note) {
    return {
      code: "invalid_input",
      error: "Write a note before requesting more information.",
      success: false,
    };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc(
    "request_community_outrider_information_v1",
    {
      p_actor_user_id: auth.user.id,
      p_outrider_id: outriderId,
      p_review_note: note.slice(0, 1000),
    },
  );

  if (error) return mapActionError(error);

  revalidatePath("/products/entry");
  revalidatePath("/products/entry/outrider");
  revalidatePath(`/products/entry/outrider/${outriderId}`);

  return {
    data: { outriderId },
    success: true,
  };
}

export async function approveOutriderSession(
  _previousState: OutriderActionResult | null,
  formData: FormData,
): Promise<OutriderActionResult> {
  const auth = await requireSuperadmin();
  const previewError = previewErrorResult();
  if (previewError) return previewError;

  const outriderId = getFormString(formData, "outrider_id");
  if (!outriderId) {
    return {
      code: "invalid_input",
      error: "Outrider information is missing.",
      success: false,
    };
  }

  const detail = await getOutriderDetail(outriderId);
  const report = detail?.currentSetupReport;
  if (
    !detail ||
    !report ||
    report.status !== "approved" ||
    report.isStale
  ) {
    return {
      code: "invalid_state",
      error: "Approve the current setup report before final Outrider approval.",
      success: false,
    };
  }

  const currentInputSha256 = inputFingerprintHex({
    outrider: buildRelevantOutriderInput(detail),
    sourceSha256: report.sourceSha256,
  });
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("approve_community_outrider_v1", {
    p_actor_user_id: auth.user.id,
    p_current_input_sha256: currentInputSha256,
    p_outrider_id: outriderId,
  });

  if (error) return mapActionError(error);

  revalidatePath("/products/entry");
  revalidatePath("/products/entry/outrider");
  revalidatePath(`/products/entry/outrider/${outriderId}`);

  return {
    data: { outriderId },
    success: true,
  };
}
