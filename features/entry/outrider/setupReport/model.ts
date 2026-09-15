export const SETUP_WORKBOOK_SCHEMA_VERSION = "entry-onboarding-workbook-v1";
export const SETUP_REPORT_SCHEMA_VERSION = "entry-outrider-setup-report-v2";

export const SETUP_WORKBOOK_TEMPLATE_FILENAME =
  "entry-setup-workbook-template-v1.xlsx";

export const SETUP_WORKBOOK_SHEETS = [
  "Meta",
  "Units",
  "Residents",
  "Destinations",
  "Admins",
] as const;

export type SetupWorkbookSheet = (typeof SETUP_WORKBOOK_SHEETS)[number];

export type SetupFindingSeverity = "error" | "warning" | "info";

export type SetupFinding = {
  code: string;
  field: string | null;
  message: string;
  row: number | null;
  severity: SetupFindingSeverity;
  sheet: SetupWorkbookSheet | "Workbook" | null;
};

export type ParsedSetupWorkbook = {
  admins: SetupWorkbookAdmin[];
  destinations: SetupWorkbookDestination[];
  meta: {
    communityName: string | null;
    notes: string | null;
    preparedAt: string | null;
  };
  residents: SetupWorkbookResident[];
  schemaVersion: string | null;
  units: SetupWorkbookUnit[];
};

export type SetupWorkbookUnit = {
  isActive: boolean | null;
  notes: string | null;
  publicReference: string | null;
  row: number;
  unitLabel: string | null;
  unitType: string | null;
};

export type SetupWorkbookResident = {
  email: string | null;
  fullName: string | null;
  phone: string | null;
  row: number;
  unitLabel: string | null;
};

export type SetupWorkbookDestination = {
  name: string | null;
  notes: string | null;
  reference: string | null;
  row: number;
  type: string | null;
  unitLabel: string | null;
};

export type SetupWorkbookAdmin = {
  email: string | null;
  fullName: string | null;
  phone: string | null;
  row: number;
  unitLabel: string | null;
};

export type SetupValidationResult = {
  counts: {
    admins: number;
    destinations: number;
    errors: number;
    residents: number;
    units: number;
    unitsMissingReferences: number;
    unitsWithReferences: number;
    warnings: number;
  };
  findings: SetupFinding[];
  hasBlockingErrors: boolean;
};

export type OutriderReportSourceMetadata = {
  fileId: string;
  filename: string;
  sha256: string;
  sha256Prefix: string;
  uploadedAt: string;
  versionLabel: string;
};

export type OutriderSetupReportSnapshot = {
  generatedAt: string;
  intake: {
    communityCity: string | null;
    communityId: string | null;
    communityName: string;
    contactName: string | null;
    hasDestinations: boolean | null;
    hasEstablishments: boolean | null;
    hasInactiveUnits: boolean | null;
    initialAdminCount: number | null;
    securityStaffCount: number | null;
    unitNamingExample: string | null;
    unitTypes: string[];
  };
  recommendation: string;
  reportSchemaVersion: typeof SETUP_REPORT_SCHEMA_VERSION;
  source: OutriderReportSourceMetadata;
  summary: {
    adminRows: number;
    destinationRows: number;
    residentCoveragePercent: number | null;
    residentRows: number;
    units: number;
    unitsMissingReferences: number;
    unitsWithReferences: number;
    warnings: number;
  };
  validation: {
    findings: SetupFinding[];
  };
  workbook: ParsedSetupWorkbook;
  workbookSchemaVersion: string;
};

export type OutriderSetupReportRecord = {
  approvedAt: string | null;
  approvedBy: string | null;
  findings: SetupFinding[];
  generatedAt: string;
  id: string;
  inputSha256: string;
  isStale: boolean;
  pdfStoragePath: string | null;
  reportSnapshot: OutriderSetupReportSnapshot;
  sourceFileId: string;
  sourceFilenameSnapshot: string;
  sourceSha256: string;
  status: "draft" | "approved" | "superseded";
  version: number;
  warningCount: number;
};

export type OutriderSetupReportAnalysis = {
  currentInputSha256: string;
  findings: SetupFinding[];
  latestSourceFileId: string;
  sourceFileId: string;
  sourceFilename: string;
  sourceSha256: string;
  summary: OutriderSetupReportSnapshot["summary"];
};
