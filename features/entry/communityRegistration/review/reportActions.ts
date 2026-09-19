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
      error: "Select at least one valid unit to generate the report.",
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
          "The report could not be built from the current data. Refresh the page and try again.",
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
        "The report could not be generated. Review data was not modified.",
    };
  }
}
