"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  FileCheck2,
  FileDown,
  FileSpreadsheet,
  FileText,
  PlayCircle,
  RefreshCw,
  RotateCw,
  Upload,
} from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  approveOutriderSession,
  analyzeSetupWorkbook,
  approveSetupReport,
  generateSetupReport,
  recoverOutriderLink,
  requestOutriderInformation,
  rotateOutriderLink,
  uploadSetupWorkbook,
  type OutriderActionResult,
} from "@/features/entry/outrider/actions";
import {
  getOutriderSectionLabel,
  getOutriderStatusLabel,
  getOutriderUnitTypeLabel,
  isOutriderEditable,
  type OutriderStatus,
} from "@/features/entry/outrider/model";
import type { OutriderDetail } from "@/features/entry/outrider/queries";
import type {
  OutriderSetupReportAnalysis,
  SetupFinding,
} from "@/features/entry/outrider/setupReport/model";

const initialActionState: OutriderActionResult | null = null;

function statusTone(status: OutriderStatus): "default" | "success" | "warning" | "info" {
  if (status === "approved") return "success";
  if (status === "ready_for_review") return "info";
  if (status === "needs_information") return "warning";
  return "default";
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function yesNo(value: boolean | null) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Not answered";
}

function eventLabel(event: OutriderDetail["events"][number]) {
  switch (event.eventType) {
    case "outrider_started":
      return "Outrider started";
    case "outrider_saved":
      return "Information updated";
    case "file_uploaded":
      return `${String(event.metadata.category ?? "File")} uploaded`;
    case "outrider_submitted":
      return "Submitted for review";
    case "information_requested":
      return "Information requested";
    case "outrider_approved":
      return "Approved for handoff";
    case "link_rotated":
      return "Secure link rotated";
    case "setup_workbook_uploaded":
      return "Setup workbook uploaded";
    case "setup_report_generated":
      return "Setup report generated";
    case "setup_report_superseded":
      return "Setup report superseded";
    case "setup_report_approved":
      return "Setup report approved";
    default:
      return "Outrider activity";
  }
}

function actorLabel(actorType: string) {
  if (actorType === "public_token") return "Public link";
  if (actorType === "entry_admin") return "Minerva";
  return "System";
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      {children}
    </div>
  );
}

function CopyField({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
      <label className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
        Secure Outrider link
      </label>
      <input
        readOnly
        value={url}
        className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-slate-950 px-3 font-mono text-xs text-white outline-none"
      />
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <a href={url} target="_blank" rel="noreferrer">
          <Button type="button" variant="secondary" className="gap-2">
            <ExternalLink className="h-4 w-4 stroke-[1.75]" />
            Open
          </Button>
        </a>
        <Button type="button" onClick={copy} className="gap-2">
          <Copy className="h-4 w-4 stroke-[1.75]" />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

function LinkControls({
  canRotate,
  outriderId,
}: {
  canRotate: boolean;
  outriderId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [rotateState, rotateAction, rotatePending] = useActionState(
    rotateOutriderLink,
    initialActionState,
  );
  const rotatedLink = rotateState?.success ? rotateState.data?.link ?? null : null;

  function recover() {
    setMessage(null);
    startTransition(async () => {
      const result = await recoverOutriderLink({ outriderId });
      if (!result.success) {
        setMessage(result.error);
        setLink(null);
        return;
      }
      setLink(result.data?.link ?? null);
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
            Sharing
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Public Outrider link
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={recover}
            disabled={isPending || rotatePending}
            className="gap-2"
          >
            <Copy className="h-4 w-4 stroke-[1.75]" />
            {isPending ? "Preparing..." : "Recover link"}
          </Button>
          {canRotate ? (
            <form action={rotateAction}>
              <input type="hidden" name="outrider_id" value={outriderId} />
              <Button
                type="submit"
                variant="secondary"
                disabled={isPending || rotatePending}
                className="gap-2"
              >
                <RotateCw className="h-4 w-4 stroke-[1.75]" />
                {rotatePending ? "Rotating..." : "Rotate link"}
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
        {canRotate
          ? "Recovering shows the current link when the encrypted payload is valid. Rotating invalidates the previous link and returns a replacement."
          : "Recovering shows the approved read-only link when the encrypted payload is valid."}
      </p>

      {message ? (
        <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {message}
        </p>
      ) : null}
      {canRotate && rotateState && !rotateState.success ? (
        <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {rotateState.error}
        </p>
      ) : null}
      {rotatedLink || link ? <CopyField url={rotatedLink ?? link ?? ""} /> : null}
    </section>
  );
}

function RequestInfoDialog({
  onClose,
  outriderId,
}: {
  onClose: () => void;
  outriderId: string;
}) {
  const [state, formAction, pending] = useActionState(
    requestOutriderInformation,
    initialActionState,
  );

  if (state?.success) {
    return (
      <Overlay>
        <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl">
          <Badge tone="warning">Needs information</Badge>
          <h3 className="mt-4 text-xl font-semibold text-white">
            Request stored
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            The public Outrider form is editable again and displays your note.
          </p>
          <div className="mt-6 flex justify-end">
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay>
      <form
        action={formAction}
        className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
          Request information
        </p>
        <h3 className="mt-2 text-xl font-semibold text-white">
          Send Outrider back for edits
        </h3>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          This note is visible on the public intake page.
        </p>

        <input type="hidden" name="outrider_id" value={outriderId} />
        <label className="mt-5 block">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Note
          </span>
          <textarea
            name="review_note"
            rows={5}
            maxLength={1000}
            required
            className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-3 text-sm text-white outline-none focus:border-violet-400/50"
          />
        </label>

        {state && !state.success ? (
          <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {state.error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Request information"}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}

function DataCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </p>
      <div className="mt-2 text-sm leading-6 text-white">{value}</div>
    </div>
  );
}

function findingTone(
  severity: SetupFinding["severity"],
): "danger" | "warning" | "info" {
  if (severity === "error") return "danger";
  if (severity === "warning") return "warning";
  return "info";
}

function FindingList({ findings }: { findings: SetupFinding[] }) {
  if (findings.length === 0) {
    return (
      <p className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
        No deterministic findings.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {findings.slice(0, 12).map((finding, index) => (
        <div
          key={`${finding.code}-${finding.row ?? "sheet"}-${index}`}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={findingTone(finding.severity)}>
              {finding.severity.toUpperCase()}
            </Badge>
            <p className="text-xs font-semibold text-white">{finding.code}</p>
          </div>
          <p className="mt-1 text-sm leading-5 text-[var(--text-muted)]">
            {[finding.sheet, finding.row ? `row ${finding.row}` : null, finding.field]
              .filter(Boolean)
              .join(" / ")}
            {finding.sheet || finding.row || finding.field ? ": " : ""}
            {finding.message}
          </p>
        </div>
      ))}
      {findings.length > 12 ? (
        <p className="text-xs text-[var(--text-muted)]">
          {findings.length - 12} additional findings hidden from this compact view.
        </p>
      ) : null}
    </div>
  );
}

function AnalysisSummary({
  analysis,
}: {
  analysis: OutriderSetupReportAnalysis;
}) {
  const errors = analysis.findings.filter(
    (finding) => finding.severity === "error",
  ).length;
  const warnings = analysis.findings.filter(
    (finding) => finding.severity === "warning",
  ).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DataCard label="Units" value={analysis.summary.units} />
        <DataCard label="Resident rows" value={analysis.summary.residentRows} />
        <DataCard label="Destinations" value={analysis.summary.destinationRows} />
        <DataCard label="Admins" value={analysis.summary.adminRows} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <DataCard
          label="References present"
          value={analysis.summary.unitsWithReferences}
        />
        <DataCard
          label="References missing"
          value={analysis.summary.unitsMissingReferences}
        />
        <DataCard
          label="Findings"
          value={`${errors} errors / ${warnings} warnings`}
        />
      </div>
      <FindingList findings={analysis.findings} />
    </div>
  );
}

function SetupReportPanel({ detail }: { detail: OutriderDetail }) {
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadSetupWorkbook,
    initialActionState,
  );
  const [analysisState, analysisAction, analysisPending] = useActionState(
    analyzeSetupWorkbook,
    initialActionState,
  );
  const [generateState, generateAction, generatePending] = useActionState(
    generateSetupReport,
    initialActionState,
  );
  const [approveState, approveAction, approvePending] = useActionState(
    approveSetupReport,
    initialActionState,
  );
  const [finalApproveState, finalApproveAction, finalApprovePending] =
    useActionState(approveOutriderSession, initialActionState);
  const latestWorkbook = detail.latestSetupWorkbook;
  const report = detail.currentSetupReport;
  const workflowLocked = detail.status === "approved";
  const analysis = analysisState?.success
    ? analysisState.data?.analysis ?? null
    : null;
  const analysisErrors =
    analysis?.findings.filter((finding) => finding.severity === "error").length ?? 0;
  const analysisMatchesLatest =
    Boolean(analysis && latestWorkbook && analysis.sourceFileId === latestWorkbook.id);
  const canGenerate = Boolean(
    !workflowLocked &&
      ((analysisMatchesLatest && analysisErrors === 0) ||
        (report && !report.isStale && report.status === "draft")),
  );
  const reportUrl = report
    ? `/products/entry/outrider/${detail.id}/setup-reports/${report.id}/pdf`
    : null;
  const canFinalApprove = Boolean(
    report?.status === "approved" && !report.isStale && !workflowLocked,
  );

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
            Setup report
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-white">
              Preliminary setup report
            </h2>
            {workflowLocked ? (
              <Badge tone="success">LOCKED</Badge>
            ) : report?.status === "approved" && !report.isStale ? (
              <Badge tone="success">APPROVED</Badge>
            ) : report?.isStale ? (
              <Badge tone="warning">OUTDATED</Badge>
            ) : report ? (
              <Badge tone="info">PRELIMINARY</Badge>
            ) : (
              <Badge tone="default">WORKBOOK REQUIRED</Badge>
            )}
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Intake information to setup workbook to validation to preliminary
            report to explicit approval. Nothing here creates operational ENTRY
            records.
          </p>
          {workflowLocked ? (
            <p className="mt-2 text-sm leading-6 text-emerald-100">
              Final Outrider approval is complete. Setup workbook and report
              mutations are locked for v1.
            </p>
          ) : null}
        </div>
        <Link href="/products/entry/outrider/setup-workbook/template">
          <Button type="button" variant="secondary" className="gap-2">
            <FileSpreadsheet className="h-4 w-4 stroke-[1.75]" />
            Download setup workbook template
          </Button>
        </Link>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-3">
          <form
            action={uploadAction}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3"
          >
            <input type="hidden" name="outrider_id" value={detail.id} />
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Upload internal setup workbook
              </span>
              <input
                name="setup_workbook"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                required
                disabled={workflowLocked}
                className="mt-2 block w-full text-sm text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-500/20 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-violet-100"
              />
            </label>
            <Button
              type="submit"
              disabled={uploadPending || workflowLocked}
              className="mt-3 gap-2"
            >
              <Upload className="h-4 w-4 stroke-[1.75]" />
              {uploadPending ? "Uploading..." : "Upload setup workbook"}
            </Button>
            {uploadState?.success ? (
              <p className="mt-3 text-sm text-emerald-200">
                Setup workbook uploaded.
              </p>
            ) : uploadState ? (
              <p className="mt-3 text-sm text-rose-200">{uploadState.error}</p>
            ) : null}
          </form>

          {latestWorkbook ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Latest setup workbook
              </p>
              <p className="mt-2 truncate text-sm font-semibold text-white">
                {latestWorkbook.originalFilename}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Uploaded {formatDate(latestWorkbook.createdAt)} ·{" "}
                {Math.round(latestWorkbook.byteSize / 1024)} KB ·{" "}
                {latestWorkbook.fileSha256
                  ? `SHA ${latestWorkbook.fileSha256.slice(0, 12)}`
                  : "hash pending"}
              </p>
              <form action={analysisAction} className="mt-3">
                <input type="hidden" name="outrider_id" value={detail.id} />
                <input type="hidden" name="source_file_id" value={latestWorkbook.id} />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={analysisPending || workflowLocked}
                  className="gap-2"
                >
                  <PlayCircle className="h-4 w-4 stroke-[1.75]" />
                  {analysisPending ? "Analyzing..." : "Analyze workbook"}
                </Button>
              </form>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center">
              <FileSpreadsheet className="mx-auto h-6 w-6 text-[var(--text-muted)]" />
              <p className="mt-3 text-sm font-semibold text-white">
                Setup workbook required
              </p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Upload a normalized internal XLSX before analysis or approval.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {analysis ? <AnalysisSummary analysis={analysis} /> : null}
          {analysisState && !analysisState.success ? (
            <p className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {analysisState.error}
            </p>
          ) : null}

          {report ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Report v{report.version}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {report.sourceFilenameSnapshot}
                  </p>
                </div>
                {report.isStale ? (
                  <Badge tone="warning">OUTDATED</Badge>
                ) : report.status === "approved" ? (
                  <Badge tone="success">APPROVED</Badge>
                ) : (
                  <Badge tone="info">PRELIMINARY</Badge>
                )}
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                Generated {formatDate(report.generatedAt)} · SHA{" "}
                {report.sourceSha256.slice(0, 12)} · {report.warningCount} warnings
              </p>
              {report.isStale ? (
                <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                  Outrider data or the setup workbook changed after this report
                  was generated.
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {reportUrl ? (
                  <>
                    <a href={reportUrl} target="_blank" rel="noreferrer">
                      <Button type="button" variant="secondary" className="gap-2">
                        <FileText className="h-4 w-4 stroke-[1.75]" />
                        Preview report
                      </Button>
                    </a>
                    <a href={`${reportUrl}?download=1`}>
                      <Button type="button" variant="secondary" className="gap-2">
                        <Download className="h-4 w-4 stroke-[1.75]" />
                        Download PDF
                      </Button>
                    </a>
                  </>
                ) : null}
                {report.status !== "approved" && !workflowLocked ? (
                  <form action={approveAction}>
                    <input type="hidden" name="outrider_id" value={detail.id} />
                    <input type="hidden" name="report_id" value={report.id} />
                    <Button
                      type="submit"
                      disabled={approvePending || report.isStale}
                      className="gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4 stroke-[1.75]" />
                      {approvePending ? "Approving..." : "Approve setup report"}
                    </Button>
                  </form>
                ) : null}
              </div>
              {approveState?.success ? (
                <p className="mt-3 text-sm text-emerald-200">
                  Setup report approved.
                </p>
              ) : approveState ? (
                <p className="mt-3 text-sm text-rose-200">{approveState.error}</p>
              ) : null}
              {report.status === "approved" || workflowLocked ? (
                <form action={finalApproveAction} className="mt-3">
                  <input type="hidden" name="outrider_id" value={detail.id} />
                  <Button
                    type="submit"
                    disabled={!canFinalApprove || finalApprovePending}
                    className="gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4 stroke-[1.75]" />
                    {finalApprovePending
                      ? "Approving Outrider..."
                      : workflowLocked
                        ? "Outrider approved"
                        : "Final approve Outrider"}
                  </Button>
                </form>
              ) : null}
              {finalApproveState?.success ? (
                <p className="mt-3 text-sm text-emerald-200">
                  Outrider approved and setup workflow locked.
                </p>
              ) : finalApproveState ? (
                <p className="mt-3 text-sm text-rose-200">
                  {finalApproveState.error}
                </p>
              ) : null}
            </div>
          ) : null}

          <form action={generateAction}>
            <input type="hidden" name="outrider_id" value={detail.id} />
            <input
              type="hidden"
              name="source_file_id"
              value={analysis?.sourceFileId ?? latestWorkbook?.id ?? ""}
            />
            <Button
              type="submit"
              disabled={!latestWorkbook || generatePending || !canGenerate}
              className="gap-2"
            >
              {analysisErrors > 0 ? (
                <AlertTriangle className="h-4 w-4 stroke-[1.75]" />
              ) : (
                <FileCheck2 className="h-4 w-4 stroke-[1.75]" />
              )}
              {generatePending ? "Generating..." : "Generate preliminary report"}
            </Button>
          </form>
          {generateState?.success ? (
            <p className="text-sm text-emerald-200">
              Preliminary report generated.
            </p>
          ) : generateState ? (
            <p className="text-sm text-rose-200">{generateState.error}</p>
          ) : null}
          {detail.setupReports.length > 1 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Report history
              </p>
              <div className="mt-3 space-y-2">
                {detail.setupReports
                  .filter((item) => item.id !== report?.id)
                  .map((item) => {
                    const url = `/products/entry/outrider/${detail.id}/setup-reports/${item.id}/pdf`;
                    return (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">
                            Report v{item.version}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {item.status} · {formatDate(item.generatedAt)}
                          </p>
                        </div>
                        <a href={`${url}?download=1`}>
                          <Button type="button" variant="secondary" className="gap-2">
                            <Download className="h-4 w-4 stroke-[1.75]" />
                            Download
                          </Button>
                        </a>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function OutriderDetailWorkspace({ detail }: { detail: OutriderDetail }) {
  const [showRequestInfo, setShowRequestInfo] = useState(false);
  const canRequestInfo = detail.status === "ready_for_review";

  return (
    <div className="space-y-5">
      <section className="px-0.5 pt-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-3xl">
            <Link
              href="/products/entry/outrider"
              className="text-sm font-semibold text-violet-200 hover:text-white"
            >
              Outrider
            </Link>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white lg:text-[2.05rem]">
              {detail.communityName}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
              Community setup handoff. No live ENTRY operational records are
              automatically imported by Outrider.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href={`/products/entry/outrider/${detail.id}/export/json`}>
              <Button type="button" variant="secondary" className="gap-2">
                <FileDown className="h-4 w-4 stroke-[1.75]" />
                JSON
              </Button>
            </a>
            <a href={`/products/entry/outrider/${detail.id}/export/package`}>
              <Button type="button" variant="secondary" className="gap-2">
                <FileArchive className="h-4 w-4 stroke-[1.75]" />
                ZIP
              </Button>
            </a>
            {canRequestInfo ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowRequestInfo(true)}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4 stroke-[1.75]" />
                Request info
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DataCard label="Status" value={<Badge tone={statusTone(detail.status)}>{getOutriderStatusLabel(detail.status)}</Badge>} />
        <DataCard label="Progress" value={`${detail.progressPercent}%`} />
        <DataCard label="Submitted" value={formatDate(detail.submittedAt)} />
        <DataCard label="Approved" value={formatDate(detail.approvedAt)} />
      </section>

      {detail.reviewNote && isOutriderEditable(detail.status) ? (
        <section className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-sm leading-6 text-amber-50/90">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
            Review note
          </p>
          <p className="mt-2">{detail.reviewNote}</p>
        </section>
      ) : null}

      <SetupReportPanel detail={detail} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
                Intake answers
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Setup profile
              </h2>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <DataCard
              label={getOutriderSectionLabel("units")}
              value={
                <div className="space-y-1">
                  <p>
                    {detail.unitTypes.map(getOutriderUnitTypeLabel).join(", ") ||
                      "Not answered"}
                  </p>
                  {detail.otherUnitType ? (
                    <p className="text-[var(--text-muted)]">
                      Other: {detail.otherUnitType}
                    </p>
                  ) : null}
                  {detail.unitNamingExample ? (
                    <p className="text-[var(--text-muted)]">
                      Naming: {detail.unitNamingExample}
                    </p>
                  ) : null}
                </div>
              }
            />
            <DataCard
              label="Establecimientos comerciales"
              value={
                <div>
                  <p>{yesNo(detail.hasEstablishments)}</p>
                  <p className="mt-1 text-[var(--text-muted)]">
                    {detail.establishmentNames.join(", ") || "No establishment names"}
                  </p>
                </div>
              }
            />
            <DataCard
              label="Áreas comunes y destinos"
              value={
                <div>
                  <p>{yesNo(detail.hasDestinations)}</p>
                  <p className="mt-1 text-[var(--text-muted)]">
                    {detail.destinationNames.join(", ") || "No destination names"}
                  </p>
                </div>
              }
            />
            <DataCard
              label="Contactos principales"
              value={
                <div className="space-y-2">
                  {detail.contacts && detail.contacts.length > 0 ? (
                    detail.contacts.map((c, idx) => (
                      <div key={idx} className="border-b border-[var(--border)] pb-2 last:border-0 last:pb-0">
                        <p className="font-semibold text-white">{c.name ?? "No contact name"}</p>
                        <p className="text-[var(--text-muted)]">{c.phone ?? "No phone"}</p>
                        <p className="text-[var(--text-muted)]">{c.email ?? "No email"}</p>
                      </div>
                    ))
                  ) : (
                    <>
                      <p className="font-semibold text-white">{detail.contactName ?? "No contact name"}</p>
                      <p className="text-[var(--text-muted)]">
                        {detail.contactPhone ?? "No phone"}
                      </p>
                      <p className="text-[var(--text-muted)]">
                        {detail.contactEmail ?? "No email"}
                      </p>
                    </>
                  )}
                </div>
              }
            />
            <DataCard
              label="Personal de seguridad"
              value={
                <div className="space-y-1">
                  <p>
                    {detail.securityStaffCount === null
                      ? "Not answered"
                      : `${detail.securityStaffCount} personas`}
                  </p>
                  <p className="text-[var(--text-muted)]">
                    {detail.securityStaffNames.join(", ") || "No guard names"}
                  </p>
                </div>
              }
            />
            <DataCard
              label={getOutriderSectionLabel("inactive_units")}
              value={
                <div>
                  <p>{yesNo(detail.hasInactiveUnits)}</p>
                  <p className="mt-1 text-[var(--text-muted)]">
                    {detail.inactiveUnitNotes ?? "No notes"}
                  </p>
                </div>
              }
            />
          </div>
        </section>

        <div className="space-y-4">
          <LinkControls
            canRotate={detail.status !== "approved"}
            outriderId={detail.id}
          />

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
              Attachments
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Uploaded files
            </h2>

            <div className="mt-4 space-y-2">
              {detail.files.length > 0 ? (
                detail.files.map((file) => (
                  <a
                    key={file.id}
                    href={`/products/entry/outrider/${detail.id}/files/${file.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-3 text-sm text-white hover:border-white/15"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {file.originalFilename}
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                        {file.category} · {Math.round(file.byteSize / 1024)} KB
                      </span>
                    </span>
                    <Download className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                  </a>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                  No files uploaded.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
          Initial access
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          Administradores iniciales
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          Personas que deben prepararse primero para activación administrativa en ENTRY.
        </p>

        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Cantidad declarada
          </p>
          <p className="mt-2 text-sm font-semibold text-white">
            {detail.initialAdminCount === null
              ? "Not answered"
              : `${detail.initialAdminCount} administradores`}
          </p>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {detail.initialAdmins.length > 0 ? (
            detail.initialAdmins.map((administrator, index) => (
              <div
                key={`${administrator.name ?? "admin"}-${index}`}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3"
              >
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Administrador {index + 1}
                </p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {administrator.name ?? "Name not provided"}
                </p>
                <div className="mt-2 space-y-1 text-sm text-[var(--text-muted)]">
                  <p>Unidad: {administrator.unit ?? "Not provided"}</p>
                  <p>Teléfono: {administrator.phone ?? "Not provided"}</p>
                  <p>Correo: {administrator.email ?? "Not provided"}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="md:col-span-2 lg:col-span-3 rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
              No initial administrators provided.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
          Activity
        </p>
        <div className="mt-4 divide-y divide-[var(--border)]">
          {detail.events.map((event) => (
            <div key={event.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  {eventLabel(event)}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  {actorLabel(event.actorType)}
                </p>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {formatDate(event.createdAt)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {showRequestInfo ? (
        <RequestInfoDialog
          onClose={() => setShowRequestInfo(false)}
          outriderId={detail.id}
        />
      ) : null}
    </div>
  );
}
