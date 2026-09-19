"use server";

import {
  getCommunityRegistrationConfirmationReport,
  type CommunityRegistrationConfirmationReport,
} from "@/features/entry/communityRegistration/review/queries";

export type CommunityRegistrationConfirmationReportLoadResult =
  | {
      success: true;
      data: CommunityRegistrationConfirmationReport;
    }
  | {
      success: false;
      error: string;
    };

type LoadReportInput = {
  campaignId: string;
  communityId: string;
  unitIds: string[];
};

export async function loadCommunityRegistrationConfirmationReport(
  input: LoadReportInput,
): Promise<CommunityRegistrationConfirmationReportLoadResult> {
  const campaignId = String(input?.campaignId ?? "").trim();
  const communityId = String(input?.communityId ?? "").trim();
  const unitIds = Array.from(
    new Set(
      Array.isArray(input?.unitIds)
        ? input.unitIds.map((value) => String(value).trim()).filter(Boolean)
        : [],
    ),
  );

  if (!campaignId || !communityId || unitIds.length === 0 || unitIds.length > 100) {
    return {
      success: false,
      error: "Selecciona al menos una vivienda válida para generar el informe.",
    };
  }

  try {
    const report = await getCommunityRegistrationConfirmationReport(
      campaignId,
      communityId,
      unitIds,
    );

    if (!report) {
      return {
        success: false,
        error:
          "No se pudo construir el informe con los datos actuales. Actualiza la página e inténtalo nuevamente.",
      };
    }

    return {
      success: true,
      data: report,
    };
  } catch (error) {
    console.error("ENTRY_CONFIRMATION_REPORT_LOAD_FAILED", {
      error: error instanceof Error ? error.message : "unknown",
      unitCount: unitIds.length,
    });

    return {
      success: false,
      error:
        "No se pudo generar el informe. Los datos de revisión no fueron modificados.",
    };
  }
}
