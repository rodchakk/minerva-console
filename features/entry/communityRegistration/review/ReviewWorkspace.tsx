"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  GitMerge,
  Home,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Search,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  confirmAndPrepareCommunityRegistrationActivation,
  createOrReplaceCommunityRegistrationCorrectionLink,
  markCommunityRegistrationUnitReviewed,
  requestCommunityRegistrationCorrection,
  type CommunityRegistrationReviewActionResult,
} from "@/features/entry/communityRegistration/review/actions";
import { QuickEditResidentDialog } from "@/features/entry/communityRegistration/review/QuickEditResidentDialog";
import { DuplicateReviewDialog } from "@/features/entry/communityRegistration/review/DuplicateReviewDialog";
import {
  dismissCommunityRegistrationDuplicate,
  type RegistrationDuplicateActionResult,
} from "@/features/entry/communityRegistration/review/duplicateActions";
import type {
  RegistrationDuplicateCandidate,
  RegistrationDuplicateReviewData,
} from "@/features/entry/communityRegistration/review/duplicateQueries";
import { QuickEditUnitDialog } from "@/features/entry/communityRegistration/review/QuickEditUnitDialog";
import { ConfirmationReportDrawer } from "@/features/entry/communityRegistration/review/ConfirmationReportDrawer";
import {
  getResidentCompletenessStatus,
  getUnitMissingFields,
} from "@/features/entry/communityRegistration/review/completeness";
import { loadCommunityRegistrationConfirmationReport } from "@/features/entry/communityRegistration/review/reportActions";
import {
  markRegistrationUnitsReadyForPatronato,
  prepareApprovedRegistrationUnitsForActivation,
} from "@/features/entry/communityRegistration/review/bulkActions";
import type {
  CommunityRegistrationQuickEditData,
  CommunityRegistrationQuickEditResident,
} from "@/features/entry/communityRegistration/review/quickEditQueries";
import type {
  CommunityRegistrationConfirmationReport,
  CommunityRegistrationReviewCampaign,
  CommunityRegistrationReviewSummary,
  CommunityRegistrationReviewUnit,
  CommunityRegistrationReviewUnitDetail,
} from "@/features/entry/communityRegistration/review/queries";

type ReviewWorkspaceProps = {
  campaign: CommunityRegistrationReviewCampaign;
  communityId: string;
  duplicateData: RegistrationDuplicateReviewData;
  loadError: string | null;
  quickEditData: CommunityRegistrationQuickEditData | null;
  selectedUnit: CommunityRegistrationReviewUnitDetail | null;
  selectedUnitId: string | null;
  selectedUnitReference: string | null;
  summary: CommunityRegistrationReviewSummary;
  units: CommunityRegistrationReviewUnit[];
};

const initialActionState: CommunityRegistrationReviewActionResult | null = null;
const initialDuplicateActionState: RegistrationDuplicateActionResult | null = null;

function statusLabel(status: string) {
  switch (status.trim().toLowerCase()) {
    case "unregistered":
      return "Not submitted";
    case "submitted":
      return "Submitted";
    case "edit_enabled":
      return "Correction open";
    case "needs_correction":
      return "Needs correction";
    case "reviewed":
      return "Ready for Patronato";
    case "confirmed":
      return "Patronato approved";
    case "processed":
      return "In Activation Queue";
    case "open":
      return "Campaign open";
    case "paused":
      return "Campaign paused";
    case "review":
      return "Review active";
    default:
      return status || "Unknown";
  }
}

function statusTone(status: string): "default" | "success" | "warning" | "info" {
  const normalized = status.trim().toLowerCase();
  if (normalized === "confirmed") return "success";
  if (["reviewed", "needs_correction", "edit_enabled", "paused"].includes(normalized)) {
    return "warning";
  }
  if (["processed", "submitted", "review", "open"].includes(normalized)) {
    return "info";
  }
  return "default";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function normalizedSearchText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-HN")
    .replace(/[^a-z0-9@.]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizedSearchPhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D+/g, "");
  if (digits.length === 11 && digits.startsWith("504")) return digits.slice(3);
  if (digits.length === 12 && digits.startsWith("504")) return digits.slice(3);
  return digits;
}

type SharedContactIssue = {
  kind: "email" | "phone";
  residentNames: string[];
  value: string;
};

function getSharedContactIssues(
  residents: Array<{
    email: string | null;
    fullName: string;
    phone: string | null;
  }>,
) {
  const groups = new Map<string, { kind: "email" | "phone"; names: string[]; value: string }>();

  for (const resident of residents) {
    const email = resident.email?.trim().toLocaleLowerCase("es-HN") || "";
    if (email) {
      const key = `email:${email}`;
      const current = groups.get(key) ?? { kind: "email" as const, names: [], value: email };
      current.names.push(resident.fullName);
      groups.set(key, current);
    }

    const phone = normalizedSearchPhone(resident.phone);
    if (phone) {
      const key = `phone:${phone}`;
      const current = groups.get(key) ?? { kind: "phone" as const, names: [], value: phone };
      current.names.push(resident.fullName);
      groups.set(key, current);
    }
  }

  return Array.from(groups.values())
    .filter((group) => group.names.length > 1)
    .map(
      (group): SharedContactIssue => ({
        kind: group.kind,
        residentNames: Array.from(new Set(group.names)),
        value: group.value,
      }),
    );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      {children}
    </div>
  );
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  return (
    <Button type="button" onClick={copy}>
      {copied ? "Copied" : "Copy correction link"}
    </Button>
  );
}

function CorrectionRequestDialog({
  campaignId,
  communityId,
  onClose,
  unitId,
  unitLabel,
}: {
  campaignId: string;
  communityId: string;
  onClose: () => void;
  unitId: string;
  unitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(
    requestCommunityRegistrationCorrection,
    initialActionState,
  );

  if (state?.success) {
    return (
      <Overlay>
        <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl">
          <Badge tone="warning">Correction requested</Badge>
          <h3 className="mt-4 text-xl font-semibold text-white">{unitLabel}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            The observation is stored. Next, create a temporary correction link
            for the resident from this unit.
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
          Request correction
        </p>
        <h3 className="mt-2 text-xl font-semibold text-white">{unitLabel}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          Write exactly what the resident must correct. This observation will be
          shown only through that household&apos;s authorized correction link.
        </p>

        <input type="hidden" name="campaign_id" value={campaignId} />
        <input type="hidden" name="campaign_unit_id" value={unitId} />
        <input type="hidden" name="community_id" value={communityId} />

        <label className="mt-5 block">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Correction note
          </span>
          <textarea
            name="observation"
            rows={5}
            maxLength={1000}
            required
            placeholder="Example: Verify the phone number for the second resident."
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
            {pending ? "Saving..." : "Request correction"}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}

function CorrectionLinkDialog({
  communityId,
  mode,
  onClose,
  unitId,
  unitLabel,
}: {
  communityId: string;
  mode: "create" | "replace";
  onClose: () => void;
  unitId: string;
  unitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(
    createOrReplaceCommunityRegistrationCorrectionLink,
    initialActionState,
  );

  if (state?.success && state.data.correctionUrl) {
    return (
      <Overlay>
        <div className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
                Resident correction
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                {mode === "replace" ? "Replacement link ready" : "Correction link ready"}
              </h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{unitLabel}</p>
            </div>
            <Badge tone="success">72 hours</Badge>
          </div>

          <div className="mt-5">
            <label
              htmlFor="correction-link"
              className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]"
            >
              Secure correction link
            </label>
            <input
              id="correction-link"
              readOnly
              value={state.data.correctionUrl}
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 font-mono text-xs text-white outline-none"
            />
          </div>

          <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-50/90">
            Copy or open this link now. ENTRY stores only the token hash. If the
            plaintext link is lost, use Replace correction link to invalidate it
            and generate another one.
          </p>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Done
            </Button>
            <a href={state.data.correctionUrl} target="_blank" rel="noreferrer">
              <Button type="button" variant="secondary">
                Open correction page
              </Button>
            </a>
            <CopyButton url={state.data.correctionUrl} />
          </div>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay>
      <form
        action={formAction}
        className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
          Resident correction
        </p>
        <h3 className="mt-2 text-xl font-semibold text-white">
          {mode === "replace" ? "Replace correction link" : "Create correction link"}
        </h3>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          {unitLabel}. The link expires after 72 hours.
          {mode === "replace"
            ? " Replacing it immediately invalidates the previous active correction link."
            : " The resident can edit only this household submission."}
        </p>

        <input type="hidden" name="campaign_unit_id" value={unitId} />
        <input type="hidden" name="community_id" value={communityId} />
        <input type="hidden" name="mode" value={mode} />

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
            {pending
              ? mode === "replace"
                ? "Replacing..."
                : "Creating..."
              : mode === "replace"
                ? "Replace correction link"
                : "Create correction link"}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}

function ActivationHandoffDialog({
  approvalAlreadyRecorded,
  campaignId,
  communityId,
  emailWarningNames,
  onClose,
  unitId,
  unitLabel,
}: {
  approvalAlreadyRecorded: boolean;
  campaignId: string;
  communityId: string;
  emailWarningNames: string[];
  onClose: () => void;
  unitId: string;
  unitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(
    confirmAndPrepareCommunityRegistrationActivation,
    initialActionState,
  );
  const result = state?.success ? state.data : null;
  const preparedCount = result?.preparedResidentCount ?? result?.convertedCount ?? 0;

  if (result) {
    return (
      <Overlay>
        <div className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl">
          <Badge tone={result.status === "processed" ? "success" : "warning"}>
            {statusLabel(result.status)}
          </Badge>
          <h3 className="mt-4 text-xl font-semibold text-white">{result.unitLabel ?? unitLabel}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            {result.message}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="Prepared" value={preparedCount} />
            <Metric label="Already queued" value={result.alreadyQueuedCount ?? 0} />
            <Metric label="Already active" value={result.alreadyActiveCount ?? 0} />
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Done
            </Button>
            {result.activationQueueUrl && result.status === "processed" ? (
              <Link href={result.activationQueueUrl}>
                <Button type="button">View in Activation Queue</Button>
              </Link>
            ) : null}
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
          {approvalAlreadyRecorded ? "Activation handoff" : "Manual approval override"}
        </p>
        <h3 className="mt-2 text-xl font-semibold text-white">
          {approvalAlreadyRecorded
            ? "Move to Activation Queue"
            : "Confirm and prepare activation"}
        </h3>
        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
          {approvalAlreadyRecorded
            ? "Patronato approval is already recorded. This final Minerva action prepares eligible residents in Activation Queue. It will not create users, PINs, or activation messages."
            : "Use this only when Patronato approved outside the ENTRY review page. ENTRY will record that manual approval and prepare eligible residents in Activation Queue. It will not create users, PINs, or activation messages."}
        </p>

        {emailWarningNames.length > 0 ? (
          <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-50/90">
            <span className="font-semibold">Email missing:</span>{" "}
            {emailWarningNames.join(", ")}. These residents can be prepared under
            the current rules, but they cannot receive an email invitation until
            a valid address is added.
          </div>
        ) : null}

        <input type="hidden" name="campaign_id" value={campaignId} />
        <input type="hidden" name="campaign_unit_id" value={unitId} />
        <input type="hidden" name="community_id" value={communityId} />
        <input type="hidden" name="unit_label" value={unitLabel} />

        {state && !state.success ? (
          <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {state.error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending} className="gap-2">
            {pending
              ? "Preparing..."
              : approvalAlreadyRecorded
                ? "Move to Activation Queue"
                : "Confirm and prepare activation"}
            {!pending && approvalAlreadyRecorded ? (
              <ArrowRight className="size-3.5" aria-hidden />
            ) : null}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}

function PatronatoApprovalBanner({
  selectedUnit,
}: {
  selectedUnit: CommunityRegistrationReviewUnitDetail;
}) {
  if (!selectedUnit.patronatoConfirmedAt) return null;

  const processed = selectedUnit.status.trim().toLowerCase() === "processed";

  return (
    <div
      className="mt-4 rounded-xl border border-emerald-400/35 bg-emerald-500/[0.09] p-4 shadow-[inset_0_1px_0_rgba(52,211,153,0.08)]"
      data-testid="patronato-approval-banner"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_0_0_6px_rgba(16,185,129,0.10)]">
            <Check className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold text-emerald-50">
              Approved by Patronato
            </p>
            <p className="mt-1 text-sm leading-5 text-emerald-100/75">
              {processed
                ? "This household was authorized by Patronato and has already been handed off to Activation Queue."
                : "This household is authorized and ready to move to Activation Queue."}
            </p>
          </div>
        </div>

        <div className="shrink-0 border-t border-emerald-300/15 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200/70">
            Approval recorded
          </p>
          <p className="mt-1 text-sm font-semibold text-emerald-50">
            {formatDate(selectedUnit.patronatoConfirmedAt)}
          </p>
          <p className="mt-1 text-xs text-emerald-100/55">Patronato review</p>
        </div>
      </div>
    </div>
  );
}

function PatronatoApprovalHistory({
  selectedUnit,
}: {
  selectedUnit: CommunityRegistrationReviewUnitDetail;
}) {
  if (!selectedUnit.patronatoConfirmedAt) return null;

  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
        Approval history
      </p>
      <div className="mt-3 flex items-start gap-3">
        <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
          <Check className="size-3" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-white">Approved by Patronato</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {formatDate(selectedUnit.patronatoConfirmedAt)}
          </p>
          <p className="mt-1 text-xs text-emerald-200/70">
            Approval recorded through the Patronato review workflow.
          </p>
        </div>
      </div>
    </div>
  );
}

function HandoffProgress({
  selectedUnit,
}: {
  selectedUnit: CommunityRegistrationReviewUnitDetail;
}) {
  const normalized = selectedUnit.status.trim().toLowerCase();
  const stages = [
    {
      done: Boolean(selectedUnit.submittedAt),
      label: "Submitted",
    },
    {
      done: Boolean(selectedUnit.reviewedAt),
      label: "Ready for Patronato",
    },
    {
      done: Boolean(selectedUnit.patronatoConfirmedAt),
      label: "Patronato approved",
    },
    {
      done: normalized === "processed",
      label: "In Activation Queue",
    },
  ];

  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {stages.map((stage, index) => (
          <div key={stage.label} className="flex items-center gap-2">
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                stage.done
                  ? "bg-emerald-500 text-white"
                  : "bg-white/8 text-[var(--text-muted)] ring-1 ring-inset ring-white/10"
              }`}
            >
              {index + 1}
            </span>
            <span
              className={
                stage.done
                  ? "text-xs font-semibold text-white"
                  : "text-xs text-[var(--text-muted)]"
              }
            >
              {stage.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({
  active = false,
  icon: Icon,
  label,
  onClick,
  tone = "violet",
  value,
}: {
  active?: boolean;
  icon?: LucideIcon;
  label: string;
  onClick?: () => void;
  tone?: "violet" | "emerald" | "amber";
  value: number;
}) {
  const iconClass =
    tone === "emerald"
      ? "bg-emerald-500/12 text-emerald-300 ring-emerald-400/15"
      : tone === "amber"
        ? "bg-amber-500/12 text-amber-300 ring-amber-400/15"
        : "bg-violet-500/12 text-violet-200 ring-violet-400/15";
  const className = `flex min-w-0 items-center gap-3 rounded-lg border px-3 py-3 text-left ${
    active
      ? "border-amber-400/35 bg-amber-500/[0.07] ring-1 ring-inset ring-amber-400/10"
      : "border-[var(--border)] bg-[var(--surface-strong)]"
  } ${onClick ? "transition hover:border-white/15 hover:bg-white/[0.025]" : ""}`;
  const content = (
    <>
      {Icon ? (
        <span className={`grid size-9 shrink-0 place-items-center rounded-full ring-1 ring-inset ${iconClass}`}>
          <Icon className="size-4" aria-hidden />
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="truncate text-[11px] text-[var(--text-muted)]">{label}</p>
        <p className="mt-0.5 text-lg font-semibold leading-none text-white">{value}</p>
      </div>
    </>
  );

  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={active} className={className}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

type UnitFilter =
  | "pending"
  | "duplicates"
  | "reviewed"
  | "activation"
  | "all"
  | "resolved";

export function ReviewWorkspace({
  campaign,
  communityId,
  duplicateData,
  loadError,
  quickEditData,
  selectedUnit,
  selectedUnitId,
  selectedUnitReference,
  summary,
  units,
}: ReviewWorkspaceProps) {
  const router = useRouter();
  const [showCorrectionRequest, setShowCorrectionRequest] = useState(false);
  const [correctionLinkMode, setCorrectionLinkMode] = useState<
    "create" | "replace" | null
  >(null);
  const [showActivationHandoff, setShowActivationHandoff] = useState(false);
  const [editingResident, setEditingResident] =
    useState<CommunityRegistrationQuickEditResident | null>(null);
  const [editingUnit, setEditingUnit] = useState(false);
  const [duplicateDialogCandidateId, setDuplicateDialogCandidateId] =
    useState<string | null>(null);
  const [selectedReportUnitIds, setSelectedReportUnitIds] = useState<string[]>([]);
  const [selectionMissingFieldCount, setSelectionMissingFieldCount] = useState(0);
  const [selectionMissingEmailCount, setSelectionMissingEmailCount] = useState(0);
  const [selectionHydrated, setSelectionHydrated] = useState(false);
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [bulkFeedback, setBulkFeedback] = useState<
    { tone: "error" | "success"; text: string } | null
  >(null);
  const [bulkPending, startBulkTransition] = useTransition();
  const [unitFilter, setUnitFilter] = useState<UnitFilter>("pending");
  const [unitSearch, setUnitSearch] = useState("");
  const [pendingUnitId, setPendingUnitId] = useState<string | null>(null);
  const [previewReport, setPreviewReport] =
    useState<CommunityRegistrationConfirmationReport | null>(null);
  const [previewMode, setPreviewMode] = useState<"single" | "selection">("single");
  const selectionRequestRef = useRef(0);
  const [reviewState, reviewAction, reviewPending] = useActionState(
    markCommunityRegistrationUnitReviewed,
    initialActionState,
  );
  const [duplicateDismissState, duplicateDismissAction, duplicateDismissPending] =
    useActionState(
      dismissCommunityRegistrationDuplicate,
      initialDuplicateActionState,
    );
  const campaignStatus = campaign.status.trim().toLowerCase();
  const reviewCapable = ["open", "review"].includes(campaignStatus);
  const selectedStatus = selectedUnit?.status.trim().toLowerCase() ?? "";
  const canMarkReviewed = reviewCapable && selectedStatus === "submitted";
  const canRequestCorrection =
    reviewCapable && ["submitted", "reviewed"].includes(selectedStatus);
  const canCreateCorrectionLink =
    reviewCapable && selectedStatus === "needs_correction";
  const canReplaceCorrectionLink =
    reviewCapable && selectedStatus === "edit_enabled";
  const canQuickEdit = selectedStatus === "submitted" && Boolean(quickEditData);
  const canQuickEditUnit =
    selectedStatus === "submitted" &&
    campaign.registrationMode === "resident_provided_units";
  const activationQueueUrl = `/products/entry/activation?community_id=${encodeURIComponent(
    communityId,
  )}`;
  const canConfirmAndPrepare = Boolean(
    selectedUnitId &&
      ((reviewCapable && ["reviewed", "confirmed"].includes(selectedStatus)) ||
        (campaignStatus === "confirmed" && selectedStatus === "confirmed")),
  );
  const isPreparedForActivation = selectedStatus === "processed";
  const selectedUnitMissingFields = selectedUnit
    ? getUnitMissingFields({
        reference: selectedUnitReference,
        residents: selectedUnit.residents,
        unitLabel: selectedUnit.unitLabel,
      })
    : [];
  const missingEmailNames = Array.from(
    new Set(
      selectedUnitMissingFields
        .filter((field) => field.code === "email" && field.residentName)
        .map((field) => field.residentName as string),
    ),
  );
  const mergedUnitIdSet = useMemo(
    () => new Set(duplicateData.mergedUnitIds),
    [duplicateData.mergedUnitIds],
  );
  const activeUnits = useMemo(
    () =>
      units.filter(
        (unit) =>
          unit.status.trim().toLowerCase() !== "merged" &&
          !mergedUnitIdSet.has(unit.id),
      ),
    [mergedUnitIdSet, units],
  );
  const resolvedUnits = useMemo(
    () =>
      duplicateData.units
        .filter((unit) => unit.resolutionType === "resolved_duplicate")
        .map((unit) => ({
          hasPendingObservation: false,
          id: unit.id,
          label: unit.label,
          patronatoConfirmedAt: unit.patronatoConfirmedAt,
          residentCount: unit.residents.length,
          reviewedAt: unit.reviewedAt,
          status: unit.status,
          submittedAt: unit.submittedAt,
        })),
    [duplicateData.units],
  );
  const selectedDuplicateUnitModel = selectedUnitId
    ? duplicateData.units.find((unit) => unit.id === selectedUnitId) ?? null
    : null;
  const selectedResolvedRegistration =
    selectedDuplicateUnitModel?.resolutionType === "resolved_duplicate"
      ? selectedDuplicateUnitModel
      : null;
  const relatedResolvedRegistrations = selectedUnitId
    ? duplicateData.units.filter(
        (unit) =>
          unit.resolutionType === "resolved_duplicate" &&
          unit.canonicalUnitId === selectedUnitId,
      )
    : [];
  const duplicateCandidatesByUnit = useMemo(() => {
    const map = new Map<string, RegistrationDuplicateCandidate[]>();

    for (const candidate of duplicateData.candidates) {
      for (const unitId of [candidate.unitAId, candidate.unitBId]) {
        const current = map.get(unitId) ?? [];
        current.push(candidate);
        current.sort((left, right) => right.score - left.score);
        map.set(unitId, current);
      }
    }

    return map;
  }, [duplicateData.candidates]);
  const statusByUnitId = useMemo(
    () =>
      new Map(
        activeUnits.map((unit) => [
          unit.id,
          unit.status.trim().toLowerCase(),
        ]),
      ),
    [activeUnits],
  );
  const selectedReadyForPatronatoIds = selectedReportUnitIds.filter(
    (unitId) =>
      statusByUnitId.get(unitId) === "submitted" &&
      !(duplicateCandidatesByUnit.get(unitId)?.length),
  );
  const selectedApprovedForActivationIds = selectedReportUnitIds.filter(
    (unitId) =>
      statusByUnitId.get(unitId) === "confirmed" &&
      !(duplicateCandidatesByUnit.get(unitId)?.length),
  );

  function runReadyForPatronatoBatch() {
    if (selectedReadyForPatronatoIds.length === 0 || bulkPending) return;

    setBulkFeedback(null);
    startBulkTransition(async () => {
      const result = await markRegistrationUnitsReadyForPatronato({
        communityId,
        unitIds: selectedReadyForPatronatoIds,
      });

      if (!result.success) {
        setBulkFeedback({ tone: "error", text: result.error });
        return;
      }

      setBulkFeedback({ tone: "success", text: result.message });
      setSelectedReportUnitIds([]);
      router.refresh();
    });
  }

  function runActivationQueueBatch() {
    if (selectedApprovedForActivationIds.length === 0 || bulkPending) return;

    setBulkFeedback(null);
    startBulkTransition(async () => {
      const result = await prepareApprovedRegistrationUnitsForActivation({
        communityId,
        unitIds: selectedApprovedForActivationIds,
      });

      if (!result.success) {
        setBulkFeedback({ tone: "error", text: result.error });
        return;
      }

      setBulkFeedback({ tone: "success", text: result.message });
      setSelectedReportUnitIds([]);
      router.refresh();
    });
  }

  const selectedDuplicateCandidate =
    selectedUnitId
      ? duplicateCandidatesByUnit.get(selectedUnitId)?.[0] ?? null
      : null;
  const selectedDuplicateTargetId =
    selectedDuplicateCandidate && selectedUnitId
      ? selectedDuplicateCandidate.unitAId === selectedUnitId
        ? selectedDuplicateCandidate.unitBId
        : selectedDuplicateCandidate.unitAId
      : null;
  const selectedDuplicateTarget =
    selectedDuplicateTargetId
      ? duplicateData.units.find((unit) => unit.id === selectedDuplicateTargetId) ??
        null
      : null;
  const selectedDuplicateSameResidentCount =
    selectedDuplicateCandidate?.residentMatches.filter(
      (match) => match.kind === "same_resident",
    ).length ?? 0;
  const selectedDuplicateContactCount =
    selectedDuplicateCandidate
      ? Math.max(
          selectedDuplicateCandidate.emailMatchCount,
          selectedDuplicateCandidate.phoneMatchCount,
        )
      : 0;
  const duplicateDialogCandidate =
    duplicateDialogCandidateId
      ? duplicateData.candidates.find(
          (candidate) => candidate.id === duplicateDialogCandidateId,
        ) ?? null
      : null;
  const registrationSearchByUnitId = useMemo(() => {
    const map = new Map<string, string>();

    for (const unit of duplicateData.units) {
      const textParts = [
        unit.label,
        unit.reference,
        ...unit.residents.flatMap((resident) => [
          resident.fullName,
          resident.email,
          resident.phone,
          resident.normalizedFullName,
          resident.normalizedEmail,
        ]),
      ];
      const phoneParts = unit.residents.flatMap((resident) => [
        resident.phone,
        resident.normalizedPhone,
      ]);

      map.set(
        unit.id,
        `${textParts.map(normalizedSearchText).join(" ")} ${phoneParts
          .map(normalizedSearchPhone)
          .join(" ")}`,
      );
    }

    return map;
  }, [duplicateData.units]);

  const dataCompleteByUnitId = useMemo(() => {
    const map = new Map<string, boolean>();

    for (const unit of duplicateData.units) {
      const missingFields = getUnitMissingFields({
        reference: unit.reference,
        residents: unit.residents.map((resident) => ({
          email: resident.email,
          fullName: resident.fullName,
          phone: resident.phone,
          position: resident.position,
        })),
        unitLabel: unit.label,
      });

      map.set(unit.id, missingFields.length === 0);
    }

    return map;
  }, [duplicateData.units]);

  const sharedContactIssuesByUnitId = useMemo(() => {
    const map = new Map<string, SharedContactIssue[]>();

    for (const unit of duplicateData.units) {
      const issues = getSharedContactIssues(unit.residents);
      if (issues.length > 0) map.set(unit.id, issues);
    }

    return map;
  }, [duplicateData.units]);

  const selectedSharedContactIssues =
    selectedUnitId ? sharedContactIssuesByUnitId.get(selectedUnitId) ?? [] : [];
  const reportableUnitIds = useMemo(
    () =>
      activeUnits
        .filter((unit) => unit.status !== "unregistered" && unit.residentCount > 0)
        .map((unit) => unit.id),
    [activeUnits],
  );
  const selectionStorageKey =
    `entry-confirmation-report-selection:${campaign.id}:${communityId}`;
  const selectedResidentCount = activeUnits
    .filter((unit) => selectedReportUnitIds.includes(unit.id))
    .reduce((total, unit) => total + unit.residentCount, 0);
  const unitFilterCounts = useMemo(
    () => ({
      activation: activeUnits.filter(
        (unit) => unit.status.trim().toLowerCase() === "processed",
      ).length,
      all: activeUnits.length,
      duplicates: activeUnits.filter((unit) =>
        duplicateCandidatesByUnit.has(unit.id),
      ).length,
      pending: activeUnits.filter((unit) =>
        ["submitted", "needs_correction", "edit_enabled"].includes(
          unit.status.trim().toLowerCase(),
        ),
      ).length,
      resolved: resolvedUnits.length,
      reviewed: activeUnits.filter((unit) =>
        ["reviewed", "confirmed"].includes(unit.status.trim().toLowerCase()),
      ).length,
    }),
    [activeUnits, duplicateCandidatesByUnit, resolvedUnits.length],
  );
  const visibleUnits = useMemo(() => {
    const normalizedSearch = normalizedSearchText(unitSearch);
    const normalizedPhone = normalizedSearchPhone(unitSearch);
    const sourceUnits = unitFilter === "resolved" ? resolvedUnits : activeUnits;

    return sourceUnits
      .filter((unit) => {
        const searchable = `${normalizedSearchText(unit.label)} ${
          registrationSearchByUnitId.get(unit.id) ?? ""
        }`;
        const matchesSearch =
          normalizedSearch.length === 0 ||
          searchable.includes(normalizedSearch) ||
          (normalizedPhone.length > 0 && searchable.includes(normalizedPhone));
        const normalizedStatus = unit.status.trim().toLowerCase();
        const matchesFilter =
          unitFilter === "all" ||
          (unitFilter === "pending" &&
            ["submitted", "needs_correction", "edit_enabled"].includes(
              normalizedStatus,
            )) ||
          (unitFilter === "reviewed" &&
            ["reviewed", "confirmed"].includes(normalizedStatus)) ||
          (unitFilter === "activation" && normalizedStatus === "processed") ||
          (unitFilter === "duplicates" && duplicateCandidatesByUnit.has(unit.id)) ||
          unitFilter === "resolved";

        return matchesSearch && matchesFilter;
      })
      .sort(
        (left, right) =>
          Number(dataCompleteByUnitId.get(right.id) === true) -
          Number(dataCompleteByUnitId.get(left.id) === true),
      );
  }, [
    activeUnits,
    dataCompleteByUnitId,
    duplicateCandidatesByUnit,
    registrationSearchByUnitId,
    resolvedUnits,
    unitFilter,
    unitSearch,
  ]);
  const detailPending = Boolean(
    pendingUnitId && pendingUnitId !== selectedUnitId,
  );

  const refreshSelectionSummary = useCallback(
    async (unitIds: string[]) => {
      const requestId = ++selectionRequestRef.current;

      if (unitIds.length === 0) {
        setSelectionMissingFieldCount(0);
        setSelectionMissingEmailCount(0);
        setSelectionLoading(false);
        return;
      }

      setSelectionLoading(true);
      const result = await loadCommunityRegistrationConfirmationReport({
        campaignId: campaign.id,
        communityId,
        unitIds,
      });

      if (requestId !== selectionRequestRef.current) return;

      setSelectionLoading(false);

      if (!result.success) {
        setReportError(result.error);
        return;
      }

      setReportError(null);
      setSelectionMissingFieldCount(result.data.summary.missingFieldCount);
      setSelectionMissingEmailCount(result.data.summary.missingEmailCount);
    },
    [campaign.id, communityId],
  );

  function saveReportSelection(unitIds: string[]) {
    setSelectedReportUnitIds(unitIds);
    window.sessionStorage.setItem(selectionStorageKey, JSON.stringify(unitIds));
    void refreshSelectionSummary(unitIds);
  }

  function toggleReportUnit(unitId: string) {
    const nextUnitIds = selectedReportUnitIds.includes(unitId)
      ? selectedReportUnitIds.filter((id) => id !== unitId)
      : [...selectedReportUnitIds, unitId];

    saveReportSelection(nextUnitIds);
  }

  function selectAllReportableUnits() {
    saveReportSelection(reportableUnitIds);
  }

  function clearReportSelection() {
    saveReportSelection([]);
  }

  useEffect(() => {
    if (selectionHydrated) return;

    let restoredUnitIds: string[] = [];

    try {
      const stored = window.sessionStorage.getItem(selectionStorageKey);
      const parsed = stored ? JSON.parse(stored) : [];

      if (Array.isArray(parsed)) {
        restoredUnitIds = parsed
          .map((value) => String(value))
          .filter((id) => reportableUnitIds.includes(id));
      }
    } catch {
      restoredUnitIds = [];
    }

    const initialUnitIds = restoredUnitIds;

    const frame = window.requestAnimationFrame(() => {
      setSelectedReportUnitIds(initialUnitIds);
      setSelectionHydrated(true);
      window.sessionStorage.setItem(
        selectionStorageKey,
        JSON.stringify(initialUnitIds),
      );
      void refreshSelectionSummary(initialUnitIds);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    refreshSelectionSummary,
    reportableUnitIds,
    selectionHydrated,
    selectionStorageKey,
  ]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPendingUnitId(null));

    return () => window.cancelAnimationFrame(frame);
  }, [selectedUnitId]);

  useEffect(() => {
    if (duplicateDismissState?.success) {
      router.refresh();
    }
  }, [duplicateDismissState, router]);

  async function openReport(unitIds: string[], mode: "single" | "selection") {
    if (unitIds.length === 0) return;

    setReportLoading(true);
    setReportError(null);

    const result = await loadCommunityRegistrationConfirmationReport({
      campaignId: campaign.id,
      communityId,
      unitIds,
    });

    setReportLoading(false);

    if (!result.success) {
      setReportError(result.error);
      return;
    }

    setPreviewMode(mode);
    setPreviewReport(result.data);
  }

  return (
    <div className="space-y-3">
      {loadError ? (
        <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {loadError}
        </div>
      ) : null}

      <section aria-label="Registration summary" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Metric icon={ClipboardList} label="Submitted" value={summary.submitted} />
        <Metric icon={Clock3} label="Ready for Patronato" value={summary.reviewed} tone="amber" />
        <Metric icon={TriangleAlert} label="Needs correction" value={summary.needsCorrection} tone="amber" />
        <Metric icon={Clock3} label="Correction open" value={summary.editEnabled} tone="amber" />
        <Metric icon={CheckCircle2} label="Patronato approved" value={summary.confirmed} tone="emerald" />
        <Metric
          active={unitFilter === "duplicates"}
          icon={TriangleAlert}
          label="Duplicates"
          onClick={() => setUnitFilter("duplicates")}
          tone="amber"
          value={duplicateData.candidateCount}
        />
        <Metric icon={Users} label="Residents" value={summary.currentResidentCount} />
      </section>

      {summary.confirmed > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-400/25 bg-emerald-500/[0.08] px-4 py-2.5 text-sm text-emerald-50/90">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-300" aria-hidden />
            {summary.confirmed} {summary.confirmed === 1 ? "unit is" : "units are"} approved by Patronato and ready to move to Activation Queue.
          </span>
          <Badge tone="success">Ready for handoff</Badge>
        </div>
      ) : null}

      {campaignStatus === "open" || campaignStatus === "paused" ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-400/20 bg-amber-500/[0.07] px-4 py-2.5 text-sm text-amber-50/85">
          <span>
            {campaignStatus === "open"
              ? "Registration remains open while submitted households are reviewed."
              : "This campaign is paused. Resume it before entering review."}
          </span>
          <Badge tone={statusTone(campaign.status)}>{statusLabel(campaign.status)}</Badge>
        </div>
      ) : null}

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-500/12 text-violet-200 ring-1 ring-inset ring-violet-400/20">
              <FileText className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">
                {selectedReportUnitIds.length} {selectedReportUnitIds.length === 1 ? "unit" : "units"} selected
                <span className="font-normal text-[var(--text-muted)]"> · {selectedResidentCount} {selectedResidentCount === 1 ? "resident" : "residents"}</span>
              </p>
              <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                <span className={selectionMissingFieldCount > 0 ? "text-amber-300" : "text-emerald-300"}>
                  Missing fields: {selectionLoading ? "Calculating..." : selectionMissingFieldCount}
                </span>
                <span> · </span>
                <span className={selectionMissingEmailCount > 0 ? "text-amber-300" : "text-emerald-300"}>
                  Missing emails: {selectionLoading ? "Calculating..." : selectionMissingEmailCount}
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={selectAllReportableUnits}
              disabled={reportableUnitIds.length === 0 || selectionLoading}
            >
              Select all
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={clearReportSelection}
              disabled={selectedReportUnitIds.length === 0 || selectionLoading}
            >
              Clear
            </Button>
            {selectedReadyForPatronatoIds.length > 0 ? (
              <Button
                type="button"
                variant="secondary"
                onClick={runReadyForPatronatoBatch}
                disabled={bulkPending || Boolean(loadError)}
              >
                {bulkPending
                  ? "Updating..."
                  : `Ready for Patronato (${selectedReadyForPatronatoIds.length})`}
              </Button>
            ) : null}
            {selectedApprovedForActivationIds.length > 0 ? (
              <Button
                type="button"
                onClick={runActivationQueueBatch}
                disabled={bulkPending || Boolean(loadError)}
              >
                {bulkPending
                  ? "Moving..."
                  : `Move to Activation Queue (${selectedApprovedForActivationIds.length})`}
              </Button>
            ) : null}
            <span className="mx-1 hidden h-7 w-px bg-[var(--border)] lg:block" aria-hidden />
            <Button
              type="button"
              className="gap-2"
              onClick={() =>
                void openReport(
                  selectedReportUnitIds,
                  selectedReportUnitIds.length === 1 ? "single" : "selection",
                )
              }
              disabled={selectedReportUnitIds.length === 0 || reportLoading}
            >
              <FileText className="size-4" aria-hidden />
              {reportLoading ? "Generating..." : "Generate report"}
            </Button>
          </div>
        </div>

        {reportError ? (
          <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {reportError}
          </p>
        ) : null}
        {bulkFeedback ? (
          <p
            className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
              bulkFeedback.tone === "success"
                ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                : "border-rose-400/20 bg-rose-500/10 text-rose-100"
            }`}
          >
            {bulkFeedback.text}
          </p>
        ) : null}
        {selectedReportUnitIds.some(
          (unitId) =>
            ["submitted", "confirmed"].includes(statusByUnitId.get(unitId) ?? "") &&
            Boolean(duplicateCandidatesByUnit.get(unitId)?.length),
        ) ? (
          <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
            Units with unresolved duplicate matches are excluded from Patronato and Activation Queue workflow actions.
          </p>
        ) : null}
      </section>

      <div className="grid gap-3 xl:h-[clamp(34rem,calc(100dvh-20rem),50rem)] xl:grid-cols-[minmax(460px,0.92fr)_minmax(0,1.08fr)]">
        <section className="flex min-h-[520px] min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] xl:min-h-0">
          <div className="border-b border-[var(--border)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">Units</h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Open a unit or use its checkbox for reports and bulk workflow actions.
                </p>
              </div>
              <Badge tone="default">{summary.totalUnits}</Badge>
            </div>

            <label className="relative mt-4 block">
              <span className="sr-only">Search units</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden />
              <input
                type="search"
                value={unitSearch}
                onChange={(event) => setUnitSearch(event.target.value)}
                placeholder="Search unit, resident, email or phone..."
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-400/45"
              />
            </label>

            <div className="mt-3 flex gap-1 overflow-x-auto pb-1" aria-label="Unit filters">
              {([
                ["pending", "Pending"],
                ["duplicates", "Duplicates"],
                ["reviewed", "Patronato"],
                ["activation", "Activation"],
                ["all", "All"],
                ["resolved", "Resolved"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setUnitFilter(value)}
                  aria-pressed={unitFilter === value}
                  className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    unitFilter === value
                      ? "border-violet-400/40 bg-violet-500/15 text-violet-100"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  {label} <span className="ml-1 opacity-70">{unitFilterCounts[value]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain p-3 [scrollbar-gutter:stable]">
            {visibleUnits.map((unit) => {
              const canOpen = unit.status !== "unregistered" && unit.residentCount > 0;
              const active = selectedUnitId === unit.id;
              const selectedForReport = selectedReportUnitIds.includes(unit.id);
              const duplicateMatches = duplicateCandidatesByUnit.get(unit.id) ?? [];
              const sharedContactIssues = sharedContactIssuesByUnitId.get(unit.id) ?? [];
              const hasSharedEmail = sharedContactIssues.some((issue) => issue.kind === "email");
              const hasSharedPhone = sharedContactIssues.some((issue) => issue.kind === "phone");
              const content = (
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-white">{unit.label}</p>
                      {active ? (
                        <span className="text-[10px] font-semibold uppercase text-violet-200">Open</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {unit.residentCount} {unit.residentCount === 1 ? "resident" : "residents"}
                      {unit.hasPendingObservation ? " · pending observation" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {dataCompleteByUnitId.get(unit.id) === true ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">
                        <CheckCircle2 className="size-3" aria-hidden />
                        Information complete
                      </span>
                    ) : dataCompleteByUnitId.get(unit.id) === false ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/25 bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold text-rose-200">
                        <TriangleAlert className="size-3" aria-hidden />
                        Information incomplete
                      </span>
                    ) : null}
                    {hasSharedEmail ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-200">
                        <Mail className="size-3" aria-hidden />
                        Shared email
                      </span>
                    ) : null}
                    {hasSharedPhone ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-200">
                        <Phone className="size-3" aria-hidden />
                        Shared phone
                      </span>
                    ) : null}
                    {duplicateMatches.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-200">
                        <TriangleAlert className="size-3" aria-hidden />
                        {duplicateMatches.length === 1
                          ? "Possible duplicate"
                          : `${duplicateMatches.length} matches`}
                      </span>
                    ) : null}
                    <Badge tone={statusTone(unit.status)}>
                      {unitFilter === "resolved" ? "Resolved duplicate" : statusLabel(unit.status)}
                    </Badge>
                  </div>
                </div>
              );

              return canOpen ? (
                <div
                  key={unit.id}
                  className={`flex min-h-[62px] items-stretch overflow-hidden rounded-lg border transition-colors ${
                    active
                      ? "border-violet-400/55 bg-violet-500/[0.07] ring-1 ring-inset ring-violet-400/10"
                      : selectedForReport
                        ? "border-[var(--border)] bg-violet-500/[0.04]"
                        : "border-[var(--border)] bg-[var(--surface-strong)]"
                  }`}
                >
                  <label
                    className={`grid w-11 shrink-0 cursor-pointer place-items-center border-r border-white/[0.07] transition ${selectedForReport ? "bg-violet-500/12" : "hover:bg-white/[0.03]"}`}
                    title="Select unit"
                  >
                    <input
                      type="checkbox"
                      checked={selectedForReport}
                      onChange={() => toggleReportUnit(unit.id)}
                      className="size-4 accent-violet-500"
                      aria-label={`Select ${unit.label}`}
                    />
                  </label>
                  <Link
                    href={`/products/entry/communities/${communityId}/registration?unit=${encodeURIComponent(unit.id)}`}
                    scroll={false}
                    onNavigate={() => {
                      if (!active) setPendingUnitId(unit.id);
                    }}
                    aria-current={active ? "page" : undefined}
                    className="min-w-0 flex-1 px-3 py-2.5 transition hover:bg-white/[0.025]"
                  >
                    {content}
                  </Link>
                </div>
              ) : (
                <div
                  key={unit.id}
                  className="min-h-[62px] rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2.5 opacity-60"
                >
                  {content}
                </div>
              );
            })}
            {visibleUnits.length === 0 ? (
              <div className="grid min-h-32 place-items-center px-4 text-center text-sm text-[var(--text-muted)]">
                No units match this filter.
              </div>
            ) : null}
          </div>
        </section>

        <section className="relative flex min-h-[520px] min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] xl:min-h-0" aria-busy={detailPending}>
          {detailPending ? (
            <div className="absolute inset-0 z-20 grid place-items-center bg-[var(--surface)]/92 p-6 backdrop-blur-sm">
              <div className="w-full max-w-xl animate-pulse space-y-4" aria-label="Loading unit">
                <div className="h-6 w-40 rounded bg-white/10" />
                <div className="h-16 rounded-lg bg-white/[0.06]" />
                <div className="grid grid-cols-4 gap-3">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="h-10 rounded bg-white/[0.05]" />
                  ))}
                </div>
                <div className="h-24 rounded-lg bg-white/[0.06]" />
                <div className="h-24 rounded-lg bg-white/[0.05]" />
              </div>
            </div>
          ) : null}
          {!selectedUnit || !selectedUnitId ? (
            <div className="grid flex-1 place-items-center px-6 py-10 text-center">
              <div>
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-violet-500/10 text-violet-200 ring-1 ring-inset ring-violet-400/20">
                  <Home className="size-5" aria-hidden />
                </span>
                <p className="mt-4 text-base font-semibold text-white">Select a unit</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-muted)]">
                  Open a unit from the list to review its submission and residents.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 [scrollbar-gutter:stable] lg:p-5">
                <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-violet-500/12 text-violet-200 ring-1 ring-inset ring-violet-400/20">
                      <Home className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold text-white">{selectedUnit.unitLabel}</h2>
                        <Badge tone={statusTone(selectedUnit.status)}>
                          {selectedResolvedRegistration
                            ? "Resolved duplicate"
                            : statusLabel(selectedUnit.status)}
                        </Badge>
                        {selectedDuplicateCandidate ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-200">
                            <TriangleAlert className="size-3" aria-hidden />
                            Under duplicate review
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        Version {selectedUnit.version} · Submitted {formatDate(selectedUnit.submittedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 sm:max-w-[280px]">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-[var(--text-muted)]">
                      <MapPin className="size-3" aria-hidden /> Unit reference
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-white" title={selectedUnitReference ?? undefined}>
                      {selectedUnitReference ?? "Reference missing"}
                    </p>
                  </div>
                </div>

                {selectedSharedContactIssues.length > 0 ? (
                  <div
                    className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] p-4"
                    data-testid="shared-contact-warning"
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-500/12 text-amber-300 ring-1 ring-inset ring-amber-400/20">
                        <TriangleAlert className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                          Shared contact review
                        </p>
                        <p className="mt-1 text-base font-semibold text-white">
                          Multiple residents use the same contact
                        </p>
                        <p className="mt-1 text-xs leading-5 text-amber-50/75">
                          This does not mean they are the same person. Review the login identity before activation because separate ENTRY accounts cannot share the same email identity.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {selectedSharedContactIssues.map((issue) => (
                        <div
                          key={`${issue.kind}:${issue.value}`}
                          className="rounded-lg border border-amber-300/15 bg-black/10 px-3 py-2.5"
                        >
                          <p className="flex items-center gap-2 text-xs font-semibold text-amber-100">
                            {issue.kind === "email" ? (
                              <Mail className="size-3.5" aria-hidden />
                            ) : (
                              <Phone className="size-3.5" aria-hidden />
                            )}
                            {issue.kind === "email" ? "Shared email" : "Shared phone"}
                          </p>
                          <p className="mt-1 break-all text-xs text-white/85">{issue.value}</p>
                          <p className="mt-1 text-xs text-[var(--text-muted)]">
                            {issue.residentNames.join(" · ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedDuplicateCandidate && selectedDuplicateTarget ? (
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-xl border border-amber-400/30 bg-amber-500/[0.07] p-4">
                      <div className="flex items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-500/12 text-amber-300 ring-1 ring-inset ring-amber-400/20">
                          <TriangleAlert className="size-5" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                            Duplicate alert
                          </p>
                          <p className="mt-1 text-base font-semibold text-white">
                            Possible duplicate found
                          </p>
                          <p className="mt-1 text-xs text-amber-50/80">
                            Possible match with{" "}
                            <span className="font-semibold text-white">
                              {selectedDuplicateTarget.label}
                            </span>
                          </p>
                          <p className="mt-1 text-xs text-amber-100/65">
                            {selectedDuplicateSameResidentCount} resident{" "}
                            {selectedDuplicateSameResidentCount === 1 ? "match" : "matches"}
                            {" · "}
                            {selectedDuplicateContactCount} contact{" "}
                            {selectedDuplicateContactCount === 1 ? "match" : "matches"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          className="gap-2"
                          onClick={() =>
                            setDuplicateDialogCandidateId(selectedDuplicateCandidate.id)
                          }
                        >
                          <GitMerge className="size-4" aria-hidden />
                          Compare & review
                        </Button>
                        <form action={duplicateDismissAction}>
                          <input type="hidden" name="campaign_id" value={campaign.id} />
                          <input type="hidden" name="community_id" value={communityId} />
                          <input
                            type="hidden"
                            name="left_unit_id"
                            value={selectedDuplicateCandidate.unitAId}
                          />
                          <input
                            type="hidden"
                            name="right_unit_id"
                            value={selectedDuplicateCandidate.unitBId}
                          />
                          <Button
                            type="submit"
                            variant="secondary"
                            disabled={duplicateDismissPending}
                          >
                            {duplicateDismissPending ? "Saving..." : "Mark not duplicate"}
                          </Button>
                        </form>
                      </div>
                      <p className="mt-3 border-t border-amber-300/10 pt-3 text-xs leading-5 text-amber-50/65">
                        This record can be reviewed as a duplicate, but advanced
                        activation records should not be merged automatically.
                      </p>
                      {duplicateDismissState && !duplicateDismissState.success ? (
                        <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                          {duplicateDismissState.error}
                        </p>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/[0.06] p-4">
                      <div className="flex items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-cyan-500/10 text-cyan-200 ring-1 ring-inset ring-cyan-400/20">
                          <CheckCircle2 className="size-5" aria-hidden />
                        </span>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                            Activation status
                          </p>
                          <p className="mt-1 text-base font-semibold text-white">
                            {selectedDuplicateUnitModel?.lifecycle.label ??
                              statusLabel(selectedUnit.status)}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-cyan-50/70">
                            {selectedDuplicateUnitModel?.lifecycle.label === "Activated"
                              ? "This household already has an activated ENTRY identity."
                              : selectedDuplicateUnitModel?.lifecycle.label ===
                                  "Prepared for activation"
                                ? "This household has already advanced to Activation Queue."
                                : "This household has not reached Activation Queue yet."}
                          </p>
                        </div>
                      </div>
                      {["Prepared for activation", "Activated"].includes(
                        selectedDuplicateUnitModel?.lifecycle.label ?? "",
                      ) ? (
                        <div className="mt-4">
                          <Link href={activationQueueUrl}>
                            <Button type="button" variant="secondary" className="gap-2">
                              Open Activation Queue
                              <ArrowRight className="size-3.5" aria-hidden />
                            </Button>
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <PatronatoApprovalBanner selectedUnit={selectedUnit} />

                {selectedUnit.review?.observation ? (
                  <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-500/10 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                    Current correction observation
                  </p>
                  <p className="mt-2 text-sm leading-6 text-amber-50/90">
                    {selectedUnit.review.observation}
                  </p>
                  </div>
                ) : null}

                <HandoffProgress selectedUnit={selectedUnit} />
                <PatronatoApprovalHistory selectedUnit={selectedUnit} />

                <div className="mt-5 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white">Residents</h3>
                  <Badge tone="default">{selectedUnit.residents.length}</Badge>
                </div>

                <div className="mt-3 space-y-2">
                  {selectedUnit.residents.map((resident) => {
                  const quickResident = quickEditData?.residents.find(
                    (item) => item.position === resident.position,
                  );
                  const completeness = getResidentCompletenessStatus(resident);

                  return (
                    <div
                      key={`${resident.position}-${resident.fullName}`}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3.5 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-white/[0.06] text-xs font-semibold text-slate-200">
                            {resident.position}
                          </span>
                          <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-white">
                                {resident.fullName}
                            </p>
                            {resident.position === 1 ? (
                              <span className="rounded-full border border-violet-300/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-100">
                                Primary resident
                              </span>
                            ) : null}
                          </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                          <span
                            className={
                              completeness.complete
                                ? "rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300"
                                : "rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-300"
                            }
                          >
                            {completeness.label}
                          </span>
                          {canQuickEdit && quickResident ? (
                            <button
                              type="button"
                              onClick={() => setEditingResident(quickResident)}
                              className="grid size-8 place-items-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition hover:bg-white/5 hover:text-white"
                              title="Edit resident"
                              aria-label={`Edit ${resident.fullName}`}
                            >
                              <Pencil className="size-3.5" aria-hidden />
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 border-t border-white/[0.06] pt-3 text-xs sm:grid-cols-2">
                        <p className="flex min-w-0 items-center gap-2 text-[var(--text-muted)]">
                          <Mail className="size-3.5 shrink-0" aria-hidden />
                          <span className="truncate text-slate-200">{resident.email ?? "Email missing"}</span>
                        </p>
                        <p className="flex items-center gap-2 text-[var(--text-muted)]">
                          <Phone className="size-3.5 shrink-0" aria-hidden />
                          <span className="text-slate-200">{resident.phone ?? "Phone missing"}</span>
                        </p>
                      </div>
                    </div>
                  );
                  })}
                </div>

                {selectedUnitMissingFields.length > 0 ? (
                  <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-500/[0.08] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                        Missing data
                      </p>
                      <p className="mt-1 text-xs text-amber-50/75">
                        Information to resolve before confirmation or activation.
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300">
                      {selectedUnitMissingFields.length}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {selectedUnitMissingFields.map((field, index) => (
                      <div
                        key={`${field.code}-${field.residentPosition ?? "unit"}-${index}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/10 bg-black/10 px-3 py-2 text-xs"
                      >
                        <span className="text-white">
                          {field.residentName
                            ? `${field.residentName} · ${selectedUnit.unitLabel}`
                            : selectedUnit.unitLabel}
                        </span>
                        <span className="font-medium text-amber-300">{field.message}</span>
                      </div>
                    ))}
                  </div>
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-3 rounded-lg border border-emerald-400/20 bg-emerald-500/[0.07] px-4 py-3">
                    <CheckCircle2 className="size-5 shrink-0 text-emerald-300" aria-hidden />
                    <div>
                      <p className="text-sm font-semibold text-emerald-100">All required data is complete.</p>
                      <p className="mt-0.5 text-xs text-emerald-100/65">This unit is ready to continue through review.</p>
                    </div>
                  </div>
                )}

                {selectedDuplicateCandidate && selectedDuplicateTarget ? (
                  <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="grid size-7 place-items-center rounded-full bg-amber-500/10 text-amber-300">
                            <GitMerge className="size-3.5" aria-hidden />
                          </span>
                          <p className="text-sm font-semibold text-white">Likely match</p>
                        </div>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          Review the other household before deciding whether to merge.
                        </p>
                      </div>
                      <Link
                        href={`/products/entry/communities/${communityId}/registration?unit=${encodeURIComponent(
                          selectedDuplicateTarget.id,
                        )}`}
                        scroll={false}
                      >
                        <Button type="button" variant="secondary">
                          View unit
                        </Button>
                      </Link>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-black/10 px-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-500/10 text-violet-200">
                          <Home className="size-4" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {selectedDuplicateTarget.label}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                            {selectedDuplicateTarget.residents.length}{" "}
                            {selectedDuplicateTarget.residents.length === 1
                              ? "resident"
                              : "residents"}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
                    </div>
                  </div>
                ) : null}

                {selectedResolvedRegistration ? (
                  <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-500/[0.05] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                      Resolved duplicate
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      Archived registration · {selectedResolvedRegistration.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                      Canonical unit:{" "}
                      {selectedResolvedRegistration.canonicalUnitId ?? "Unknown"} · Resolved{" "}
                      {formatDate(selectedResolvedRegistration.resolvedAt)}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-300">
                      This registration remains available for audit and search. It was
                      archived without rewriting the surviving operational identity.
                    </p>
                  </div>
                ) : null}

                {relatedResolvedRegistrations.length > 0 ? (
                  <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200">
                      Related registrations
                    </p>
                    <div className="mt-3 space-y-2">
                      {relatedResolvedRegistrations.map((registration) => (
                        <div
                          key={registration.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-black/10 px-3 py-2.5"
                        >
                          <div>
                            <p className="text-sm font-semibold text-white">
                              Resolved duplicate · {registration.label}
                            </p>
                            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                              Archived {formatDate(registration.resolvedAt)}
                            </p>
                          </div>
                          <Link
                            href={`/products/entry/communities/${communityId}/registration?unit=${encodeURIComponent(
                              registration.id,
                            )}`}
                            scroll={false}
                          >
                            <Button type="button" variant="secondary">
                              View archived
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {reviewState && !reviewState.success ? (
                  <p className="mt-4 rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    {reviewState.error}
                  </p>
                ) : null}

                {!reviewCapable && !isPreparedForActivation && !canConfirmAndPrepare ? (
                  <p className="mt-5 text-sm leading-6 text-[var(--text-muted)]">
                    Review actions are read-only until the campaign can accept review.
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-col gap-3 border-t border-[var(--border)] bg-[var(--surface-elevated)]/95 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{selectedUnit.unitLabel}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {selectedUnit.residents.length} {selectedUnit.residents.length === 1 ? "resident" : "residents"} · {selectedUnitMissingFields.length === 0 ? "Data complete" : `${selectedUnitMissingFields.length} missing`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {canQuickEditUnit ? (
                    <Button type="button" variant="secondary" className="gap-2" onClick={() => setEditingUnit(true)}>
                      <Pencil className="size-3.5" aria-hidden /> Edit
                    </Button>
                  ) : null}

                {isPreparedForActivation ? (
                  <Link href={activationQueueUrl}>
                      <Button type="button" className="gap-2">View in Activation Queue <ArrowRight className="size-3.5" aria-hidden /></Button>
                  </Link>
                ) : null}

                {canRequestCorrection ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowCorrectionRequest(true)}
                  >
                      <TriangleAlert className="mr-2 size-3.5" aria-hidden /> Request correction
                  </Button>
                ) : null}

                {canCreateCorrectionLink ? (
                  <Button
                    type="button"
                    onClick={() => setCorrectionLinkMode("create")}
                  >
                    Create correction link
                  </Button>
                ) : null}

                {canReplaceCorrectionLink ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setCorrectionLinkMode("replace")}
                  >
                    Replace correction link
                  </Button>
                ) : null}

                {canConfirmAndPrepare && !selectedDuplicateCandidate ? (
                  <Button
                    type="button"
                    onClick={() => setShowActivationHandoff(true)}
                    disabled={Boolean(loadError)}
                    className="gap-2"
                  >
                    {selectedStatus === "confirmed"
                      ? "Move to Activation Queue"
                      : "Manual approval override"}
                    {selectedStatus === "confirmed" ? (
                      <ArrowRight className="size-3.5" aria-hidden />
                    ) : null}
                  </Button>
                ) : null}

                {selectedDuplicateCandidate &&
                ["submitted", "reviewed", "confirmed"].includes(selectedStatus) ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100">
                    <TriangleAlert className="size-3.5" aria-hidden />
                    Resolve duplicate before Patronato or Activation
                  </span>
                ) : null}

                {canMarkReviewed && !selectedDuplicateCandidate ? (
                  <form action={reviewAction}>
                    <input type="hidden" name="campaign_unit_id" value={selectedUnitId} />
                    <input type="hidden" name="community_id" value={communityId} />
                    <Button type="submit" disabled={reviewPending || Boolean(loadError)}>
                        {reviewPending ? "Updating..." : "Ready for Patronato"}
                    </Button>
                  </form>
                ) : null}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {showCorrectionRequest && selectedUnit && selectedUnitId ? (
        <CorrectionRequestDialog
          campaignId={campaign.id}
          communityId={communityId}
          onClose={() => setShowCorrectionRequest(false)}
          unitId={selectedUnitId}
          unitLabel={selectedUnit.unitLabel}
        />
      ) : null}

      {correctionLinkMode && selectedUnit && selectedUnitId ? (
        <CorrectionLinkDialog
          communityId={communityId}
          mode={correctionLinkMode}
          onClose={() => setCorrectionLinkMode(null)}
          unitId={selectedUnitId}
          unitLabel={selectedUnit.unitLabel}
        />
      ) : null}

      {showActivationHandoff && selectedUnit && selectedUnitId ? (
        <ActivationHandoffDialog
          approvalAlreadyRecorded={selectedStatus === "confirmed"}
          campaignId={campaign.id}
          communityId={communityId}
          emailWarningNames={missingEmailNames}
          onClose={() => setShowActivationHandoff(false)}
          unitId={selectedUnitId}
          unitLabel={selectedUnit.unitLabel}
        />
      ) : null}

      {editingUnit && selectedUnit && selectedUnitId ? (
        <QuickEditUnitDialog
          campaignUnitId={selectedUnitId}
          communityId={communityId}
          currentLabel={selectedUnit.unitLabel}
          onClose={() => setEditingUnit(false)}
        />
      ) : null}

      {editingResident && selectedUnitId && quickEditData ? (
        <QuickEditResidentDialog
          campaignUnitId={selectedUnitId}
          communityId={communityId}
          onClose={() => setEditingResident(null)}
          resident={editingResident}
          submissionId={quickEditData.submissionId}
        />
      ) : null}

      {duplicateDialogCandidate && selectedUnitId ? (
        <DuplicateReviewDialog
          campaignId={campaign.id}
          candidate={duplicateDialogCandidate}
          communityId={communityId}
          onClose={() => setDuplicateDialogCandidateId(null)}
          selectedUnitId={selectedUnitId}
          units={duplicateData.units}
        />
      ) : null}

      {previewReport ? (
        <ConfirmationReportDrawer
          mode={previewMode}
          onClose={() => setPreviewReport(null)}
          report={previewReport}
        />
      ) : null}
    </div>
  );
}
