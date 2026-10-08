"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Copy,
  FileText,
  Filter,
  GitMerge,
  Home,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Search,
  TriangleAlert,
  Users,
  X,
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
import { recordCommunityRegistrationWhatsAppContact } from "@/features/entry/communityRegistration/review/contactActions";
import type { CommunityRegistrationContactEvent } from "@/features/entry/communityRegistration/review/contactQueries";
import {
  buildResidentContactIssues,
  buildResidentContactIssueSignature,
  buildResidentContactMessage,
  getSharedContactIssues,
  normalizeWhatsAppNumber,
  type SharedContactIssue,
} from "@/features/entry/communityRegistration/review/residentContact";
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
  communityName: string;
  contactStatuses: CommunityRegistrationContactEvent[];
  duplicateData: RegistrationDuplicateReviewData;
  loadError: string | null;
  quickEditData: CommunityRegistrationQuickEditData | null;
  selectedUnit: CommunityRegistrationReviewUnitDetail | null;
  selectedUnitId: string | null;
  selectedUnitReference: string | null;
  selectedContactHistory: CommunityRegistrationContactEvent[];
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

type UnitWorkflowFilter =
  | "all"
  | "pending"
  | "reviewed"
  | "confirmed"
  | "activation"
  | "resolved";

type UnitAttentionFilter =
  | "all"
  | "duplicates"
  | "incomplete"
  | "shared_contact"
  | "contacted"
  | "new_info";

export function ReviewWorkspace({
  campaign,
  communityId,
  communityName,
  contactStatuses,
  duplicateData,
  loadError,
  quickEditData,
  selectedUnit,
  selectedUnitId,
  selectedUnitReference,
  selectedContactHistory,
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
  const [unitFilter, setUnitFilter] = useState<UnitWorkflowFilter>("pending");
  const [attentionFilter, setAttentionFilter] = useState<UnitAttentionFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [unitSearch, setUnitSearch] = useState("");
  const [pendingUnitId, setPendingUnitId] = useState<string | null>(null);
  const [selectedContactPosition, setSelectedContactPosition] = useState("");
  const [contactMessageCopied, setContactMessageCopied] = useState(false);
  const [contactFeedback, setContactFeedback] = useState<
    { tone: "error" | "success"; text: string } | null
  >(null);
  const [contactPending, startContactTransition] = useTransition();
  const [previewReport, setPreviewReport] =
    useState<CommunityRegistrationConfirmationReport | null>(null);
  const [previewMode, setPreviewMode] = useState<"single" | "selection">("single");
  const selectionRequestRef = useRef(0);
  const filterRef = useRef<HTMLDivElement>(null);
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
  const duplicateUnitById = useMemo(
    () => new Map(duplicateData.units.map((unit) => [unit.id, unit])),
    [duplicateData.units],
  );

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
  const residentContactIssues = selectedUnit
    ? buildResidentContactIssues({
        reference: selectedUnitReference,
        residents: selectedUnit.residents,
        unitLabel: selectedUnit.unitLabel,
      })
    : [];
  const residentContactIssueSignature =
    buildResidentContactIssueSignature(residentContactIssues);
  const residentContactMessage =
    selectedUnit && residentContactIssues.length > 0
      ? buildResidentContactMessage({
          communityName,
          issues: residentContactIssues,
          unitLabel: selectedUnit.unitLabel,
        })
      : "";
  const contactCandidates =
    selectedUnit?.residents
      .filter((resident) => normalizeWhatsAppNumber(resident.phone))
      .map((resident) => ({
        fullName: resident.fullName,
        phone: resident.phone as string,
        position: resident.position,
        whatsappNumber: normalizeWhatsAppNumber(resident.phone) as string,
      })) ?? [];
  const effectiveContact =
    contactCandidates.find(
      (candidate) => String(candidate.position) === selectedContactPosition,
    ) ??
    contactCandidates[0] ??
    null;
  const latestSelectedContact =
    selectedContactHistory[0] ??
    contactStatuses.find((event) => event.unitId === selectedUnitId) ??
    null;
  const selectedContactMatchesCurrentIssues = Boolean(
    latestSelectedContact &&
      residentContactIssueSignature &&
      latestSelectedContact.issueSignature === residentContactIssueSignature,
  );
  const selectedHasNewContactIssues = Boolean(
    latestSelectedContact &&
      residentContactIssueSignature &&
      latestSelectedContact.issueSignature !== residentContactIssueSignature,
  );

  const latestContactByUnitId = useMemo(
    () => new Map(contactStatuses.map((event) => [event.unitId, event])),
    [contactStatuses],
  );
  const contactStateByUnitId = useMemo(() => {
    const map = new Map<string, "contacted" | "new_info">();

    for (const unit of duplicateData.units) {
      const latestContact = latestContactByUnitId.get(unit.id);
      if (!latestContact) continue;

      const issues = buildResidentContactIssues({
        reference: unit.reference,
        residents: unit.residents,
        unitLabel: unit.label,
      });
      const signature = buildResidentContactIssueSignature(issues);

      map.set(
        unit.id,
        issues.length === 0 || signature === latestContact.issueSignature
          ? "contacted"
          : "new_info",
      );
    }

    return map;
  }, [duplicateData.units, latestContactByUnitId]);

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

  const workflowFilterCounts = useMemo(
    () => ({
      activation: activeUnits.filter(
        (unit) => unit.status.trim().toLowerCase() === "processed",
      ).length,
      all: activeUnits.length,
      confirmed: activeUnits.filter(
        (unit) => unit.status.trim().toLowerCase() === "confirmed",
      ).length,
      pending: activeUnits.filter((unit) =>
        ["submitted", "needs_correction", "edit_enabled"].includes(
          unit.status.trim().toLowerCase(),
        ),
      ).length,
      resolved: resolvedUnits.length,
      reviewed: activeUnits.filter(
        (unit) => unit.status.trim().toLowerCase() === "reviewed",
      ).length,
    }),
    [activeUnits, resolvedUnits.length],
  );

  const attentionFilterCounts = useMemo(
    () => ({
      all: activeUnits.length,
      contacted: activeUnits.filter(
        (unit) => contactStateByUnitId.get(unit.id) === "contacted",
      ).length,
      duplicates: activeUnits.filter((unit) =>
        duplicateCandidatesByUnit.has(unit.id),
      ).length,
      incomplete: activeUnits.filter(
        (unit) => dataCompleteByUnitId.get(unit.id) === false,
      ).length,
      new_info: activeUnits.filter(
        (unit) => contactStateByUnitId.get(unit.id) === "new_info",
      ).length,
      shared_contact: activeUnits.filter(
        (unit) => (sharedContactIssuesByUnitId.get(unit.id)?.length ?? 0) > 0,
      ).length,
    }),
    [
      activeUnits,
      contactStateByUnitId,
      dataCompleteByUnitId,
      duplicateCandidatesByUnit,
      sharedContactIssuesByUnitId,
    ],
  );

  const registrationSearchByUnitId = useMemo(() => {
    const map = new Map<string, string>();

    for (const unit of duplicateData.units) {
      const duplicateMatches = duplicateCandidatesByUnit.get(unit.id) ?? [];
      const sharedIssues = sharedContactIssuesByUnitId.get(unit.id) ?? [];
      const contactState = contactStateByUnitId.get(unit.id) ?? "";
      const complete = dataCompleteByUnitId.get(unit.id) === true;
      const textParts = [
        unit.label,
        unit.reference,
        unit.status,
        statusLabel(unit.status),
        unit.lifecycle.label,
        complete
          ? "information complete data complete complete"
          : "information incomplete data incomplete missing information",
        duplicateMatches.length > 0
          ? "possible duplicate duplicates duplicate review"
          : "",
        sharedIssues.some((issue) => issue.kind === "email")
          ? "shared email"
          : "",
        sharedIssues.some((issue) => issue.kind === "phone")
          ? "shared phone"
          : "",
        contactState === "contacted"
          ? "contacted whatsapp follow up"
          : contactState === "new_info"
            ? "new information needed follow up"
            : "",
        ...unit.residents.flatMap((resident) => [
          resident.fullName,
          resident.email,
          resident.phone,
          resident.normalizedFullName,
          resident.normalizedEmail,
          resident.normalizedPhone,
        ]),
      ];

      map.set(
        unit.id,
        textParts.map(normalizedSearchText).join(" "),
      );
    }

    return map;
  }, [
    contactStateByUnitId,
    dataCompleteByUnitId,
    duplicateCandidatesByUnit,
    duplicateData.units,
    sharedContactIssuesByUnitId,
  ]);

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

        const matchesWorkflow =
          unitFilter === "all" ||
          (unitFilter === "pending" &&
            ["submitted", "needs_correction", "edit_enabled"].includes(
              normalizedStatus,
            )) ||
          (unitFilter === "reviewed" && normalizedStatus === "reviewed") ||
          (unitFilter === "confirmed" && normalizedStatus === "confirmed") ||
          (unitFilter === "activation" && normalizedStatus === "processed") ||
          unitFilter === "resolved";

        const matchesAttention =
          attentionFilter === "all" ||
          (attentionFilter === "duplicates" &&
            duplicateCandidatesByUnit.has(unit.id)) ||
          (attentionFilter === "incomplete" &&
            dataCompleteByUnitId.get(unit.id) === false) ||
          (attentionFilter === "shared_contact" &&
            (sharedContactIssuesByUnitId.get(unit.id)?.length ?? 0) > 0) ||
          (attentionFilter === "contacted" &&
            contactStateByUnitId.get(unit.id) === "contacted") ||
          (attentionFilter === "new_info" &&
            contactStateByUnitId.get(unit.id) === "new_info");

        return matchesSearch && matchesWorkflow && matchesAttention;
      })
      .sort((left, right) => {
        const leftPriority =
          Number(duplicateCandidatesByUnit.has(left.id)) * 4 +
          Number(dataCompleteByUnitId.get(left.id) === false) * 3 +
          Number(contactStateByUnitId.get(left.id) === "new_info") * 2 +
          Number(left.status.trim().toLowerCase() === "submitted");
        const rightPriority =
          Number(duplicateCandidatesByUnit.has(right.id)) * 4 +
          Number(dataCompleteByUnitId.get(right.id) === false) * 3 +
          Number(contactStateByUnitId.get(right.id) === "new_info") * 2 +
          Number(right.status.trim().toLowerCase() === "submitted");

        if (rightPriority !== leftPriority) return rightPriority - leftPriority;
        return left.label.localeCompare(right.label, "es-HN", {
          numeric: true,
          sensitivity: "base",
        });
      });
  }, [
    activeUnits,
    attentionFilter,
    contactStateByUnitId,
    dataCompleteByUnitId,
    duplicateCandidatesByUnit,
    registrationSearchByUnitId,
    resolvedUnits,
    sharedContactIssuesByUnitId,
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

  async function copyResidentContactMessage() {
    if (!residentContactMessage) return;
    await navigator.clipboard.writeText(residentContactMessage);
    setContactMessageCopied(true);
    window.setTimeout(() => setContactMessageCopied(false), 2200);
  }

  function openResidentWhatsApp() {
    if (!effectiveContact || !residentContactMessage) return;
    const url = `https://wa.me/${effectiveContact.whatsappNumber}?text=${encodeURIComponent(
      residentContactMessage,
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function markResidentWhatsAppContacted() {
    if (!selectedUnitId || !effectiveContact || contactPending) return;

    setContactFeedback(null);
    startContactTransition(async () => {
      const result = await recordCommunityRegistrationWhatsAppContact({
        communityId,
        recipientPosition: effectiveContact.position,
        unitId: selectedUnitId,
      });

      if (!result.success) {
        setContactFeedback({ tone: "error", text: result.error });
        return;
      }

      setContactFeedback({
        tone: "success",
        text: `Contact recorded for ${result.data.recipientName}.`,
      });
      router.refresh();
    });
  }

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
    const frame = window.requestAnimationFrame(() => {
      setPendingUnitId(null);
      setSelectedContactPosition("");
      setContactMessageCopied(false);
      setContactFeedback(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedUnitId]);

  useEffect(() => {
    if (duplicateDismissState?.success) {
      router.refresh();
    }
  }, [duplicateDismissState, router]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      if (filterOpen) {
        setFilterOpen(false);
        return;
      }

      if (selectedUnitId) {
        router.replace(
          `/products/entry/communities/${communityId}/registration`,
          { scroll: false },
        );
      }
    }

    function onPointerDown(event: MouseEvent) {
      if (!filterOpen) return;
      const target = event.target as Node;
      if (!filterRef.current?.contains(target)) {
        setFilterOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [communityId, filterOpen, router, selectedUnitId]);

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
        <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {loadError}
        </div>
      ) : null}

      <section
        aria-label="Registration summary"
        className="relative grid overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-[72px] before:bg-[#7553FF] lg:grid-cols-4"
      >
        {([
          {
            active: unitFilter === "pending" && attentionFilter === "all",
            label: "Needs review",
            value: workflowFilterCounts.pending,
            hint: "Submitted or correction work",
            onClick: () => {
              setUnitFilter("pending");
              setAttentionFilter("all");
            },
          },
          {
            active: unitFilter === "reviewed" && attentionFilter === "all",
            label: "Ready for Patronato",
            value: workflowFilterCounts.reviewed,
            hint: "Waiting for approval",
            onClick: () => {
              setUnitFilter("reviewed");
              setAttentionFilter("all");
            },
          },
          {
            active: unitFilter === "confirmed" && attentionFilter === "all",
            label: "Patronato approved",
            value: workflowFilterCounts.confirmed,
            hint: "Ready for activation handoff",
            onClick: () => {
              setUnitFilter("confirmed");
              setAttentionFilter("all");
            },
          },
          {
            active: unitFilter === "activation" && attentionFilter === "all",
            label: "Activation Queue",
            value: workflowFilterCounts.activation,
            hint: `${summary.currentResidentCount} residents in campaign`,
            onClick: () => {
              setUnitFilter("activation");
              setAttentionFilter("all");
            },
          },
        ] as const).map((item, index) => (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            className={`min-h-[84px] px-4 py-3.5 text-left transition hover:bg-white/[0.015] ${
              index > 0 ? "border-t border-white/[0.07] lg:border-l lg:border-t-0" : ""
            } ${
              item.active
                ? "bg-[rgba(117,83,255,0.055)] shadow-[inset_0_-2px_0_#7553FF]"
                : ""
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#8F879D]">
              {item.label}
            </p>
            <p className="mt-1.5 text-xl font-semibold text-white">{item.value}</p>
            <p className="mt-1 text-[10px] text-[#A9A3B2]">{item.hint}</p>
          </button>
        ))}
      </section>

      {campaignStatus === "open" || campaignStatus === "paused" ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-400/20 bg-amber-500/[0.055] px-4 py-2 text-xs text-amber-50/85">
          <span>
            {campaignStatus === "open"
              ? "Registration remains open while submitted households are reviewed."
              : "This campaign is paused. Resume it before entering review."}
          </span>
          <Badge tone={statusTone(campaign.status)}>{statusLabel(campaign.status)}</Badge>
        </div>
      ) : null}

      <section className="relative flex min-h-[560px] flex-col overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] xl:h-[clamp(36rem,calc(100dvh-21rem),56rem)]">
        <div className="grid gap-3 border-b border-[#141119] px-4 py-3 lg:grid-cols-[auto_minmax(320px,1fr)_auto] lg:items-center">
          <div className="min-w-[220px]">
            <h2 className="text-base font-semibold text-white">Household review</h2>
            <p className="mt-1 text-[10px] text-[#A9A3B2]">
              {visibleUnits.length} visible · {summary.totalUnits} total units
            </p>
          </div>

          <label className="relative block w-full max-w-[680px]">
            <span className="sr-only">Search registration records</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8F879D]"
              aria-hidden
            />
            <input
              type="search"
              value={unitSearch}
              onChange={(event) => setUnitSearch(event.target.value)}
              placeholder="Search unit, reference, resident, email, phone, status or issue..."
              className="h-9 w-full rounded-lg border border-[#141119] bg-[rgba(0,0,32,0.20)] pl-9 pr-3 text-sm text-[#E7E5EA] shadow-[inset_0_1px_0_#141119] outline-none placeholder:text-[#8F879D] focus:shadow-[inset_0_1px_0_#141119,0_0_0_2px_#7553FF]"
            />
          </label>

          <div ref={filterRef} className="relative justify-self-end">
            <button
              type="button"
              onClick={() => setFilterOpen((value) => !value)}
              aria-expanded={filterOpen}
              className="inline-flex h-9 min-w-[104px] items-center justify-center gap-2 rounded-[7px] border border-[#141119] bg-[#2E2936] px-3 text-xs font-semibold text-white shadow-[0_2px_0_#141119]"
            >
              <Filter className="size-3.5" aria-hidden />
              Filters
              <span className="grid size-4 place-items-center rounded-[4px] bg-[#7553FF] text-[9px] text-white">
                {1 + Number(attentionFilter !== "all")}
              </span>
            </button>

            {filterOpen ? (
              <div className="absolute right-0 top-11 z-40 w-[330px] overflow-hidden rounded-lg border border-[#141119] bg-[#24202B] shadow-[0_18px_45px_rgba(0,0,0,0.42)]">
                <div className="flex items-center justify-between border-b border-[#141119] px-3.5 py-3">
                  <div>
                    <p className="text-xs font-semibold text-white">Filter registrations</p>
                    <p className="mt-0.5 text-[10px] text-[#8F879D]">
                      Combine workflow and attention filters.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUnitFilter("all");
                      setAttentionFilter("all");
                    }}
                    className="text-[10px] font-semibold text-[#BEB4FF] hover:text-white"
                  >
                    Clear
                  </button>
                </div>

                <div className="p-2.5">
                  <p className="px-2 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
                    Workflow
                  </p>
                  {([
                    ["all", "All active records", workflowFilterCounts.all],
                    ["pending", "Needs review", workflowFilterCounts.pending],
                    ["reviewed", "Ready for Patronato", workflowFilterCounts.reviewed],
                    ["confirmed", "Patronato approved", workflowFilterCounts.confirmed],
                    ["activation", "Activation Queue", workflowFilterCounts.activation],
                    ["resolved", "Resolved duplicates", workflowFilterCounts.resolved],
                  ] as const).map(([value, label, count]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setUnitFilter(value)}
                      className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs ${
                        unitFilter === value
                          ? "bg-[rgba(117,83,255,0.08)] text-white"
                          : "text-[#D3CEDA] hover:bg-white/[0.03] hover:text-white"
                      }`}
                    >
                      <span>{label}</span>
                      <span className="text-[10px] text-[#8F879D]">{count}</span>
                    </button>
                  ))}

                  <div className="my-2 border-t border-white/[0.07]" />
                  <p className="px-2 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
                    Attention
                  </p>
                  {([
                    ["all", "Any attention state", attentionFilterCounts.all],
                    ["duplicates", "Possible duplicates", attentionFilterCounts.duplicates],
                    ["incomplete", "Missing information", attentionFilterCounts.incomplete],
                    ["shared_contact", "Shared contact", attentionFilterCounts.shared_contact],
                    ["new_info", "New information needed", attentionFilterCounts.new_info],
                    ["contacted", "Contacted", attentionFilterCounts.contacted],
                  ] as const).map(([value, label, count]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAttentionFilter(value)}
                      className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs ${
                        attentionFilter === value
                          ? "bg-[rgba(117,83,255,0.08)] text-white"
                          : "text-[#D3CEDA] hover:bg-white/[0.03] hover:text-white"
                      }`}
                    >
                      <span>{label}</span>
                      <span className="text-[10px] text-[#8F879D]">{count}</span>
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setFilterOpen(false)}
                    className="mt-2 h-8 w-full rounded-md border border-[#141119] bg-[#2E2936] text-xs font-semibold text-white"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {selectedReportUnitIds.length > 0 ? (
          <div className="flex flex-col gap-3 border-b border-[#141119] bg-[rgba(117,83,255,0.035)] px-4 py-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white">
                {selectedReportUnitIds.length} {selectedReportUnitIds.length === 1 ? "unit" : "units"} selected · {selectedResidentCount} {selectedResidentCount === 1 ? "resident" : "residents"}
              </p>
              <p className="mt-1 text-[10px] text-[#A9A3B2]">
                Missing fields: {selectionLoading ? "Calculating..." : selectionMissingFieldCount}
                {" · "}
                Missing emails: {selectionLoading ? "Calculating..." : selectionMissingEmailCount}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" onClick={clearReportSelection} disabled={selectionLoading}>
                Clear
              </Button>
              {selectedReadyForPatronatoIds.length > 0 ? (
                <Button type="button" variant="secondary" onClick={runReadyForPatronatoBatch} disabled={bulkPending || Boolean(loadError)}>
                  {bulkPending ? "Updating..." : `Ready for Patronato (${selectedReadyForPatronatoIds.length})`}
                </Button>
              ) : null}
              {selectedApprovedForActivationIds.length > 0 ? (
                <Button type="button" onClick={runActivationQueueBatch} disabled={bulkPending || Boolean(loadError)}>
                  {bulkPending ? "Moving..." : `Move to Activation Queue (${selectedApprovedForActivationIds.length})`}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                onClick={() =>
                  void openReport(
                    selectedReportUnitIds,
                    selectedReportUnitIds.length === 1 ? "single" : "selection",
                  )
                }
                disabled={reportLoading}
              >
                <FileText className="size-4" aria-hidden />
                {reportLoading ? "Generating..." : "Generate report"}
              </Button>
            </div>
          </div>
        ) : null}

        {selectedReportUnitIds.some(
          (unitId) =>
            ["submitted", "confirmed"].includes(statusByUnitId.get(unitId) ?? "") &&
            Boolean(duplicateCandidatesByUnit.get(unitId)?.length),
        ) ? (
          <p className="mx-4 mt-3 rounded-lg border border-amber-400/20 bg-amber-500/[0.07] px-3 py-2 text-xs leading-5 text-amber-100">
            Units with unresolved duplicate matches remain selectable for reports, but are excluded from Patronato and Activation Queue bulk workflow actions.
          </p>
        ) : null}

        {reportError ? (
          <p className="mx-4 mt-3 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            {reportError}
          </p>
        ) : null}
        {bulkFeedback ? (
          <p className={`mx-4 mt-3 rounded-lg border px-3 py-2 text-xs ${
            bulkFeedback.tone === "success"
              ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
              : "border-rose-400/20 bg-rose-500/10 text-rose-100"
          }`}>
            {bulkFeedback.text}
          </p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto overscroll-contain [scrollbar-gutter:stable] [touch-action:pan-y]">
          <table className="w-full min-w-[1180px] table-fixed border-collapse text-left text-xs">
            <colgroup>
              <col className="w-11" />
              <col className="w-[17%]" />
              <col className="w-[22%]" />
              <col className="w-[14%]" />
              <col className="w-[18%]" />
              <col className="w-[16%]" />
              <col className="w-[12%]" />
              <col className="w-9" />
            </colgroup>
            <thead className="sticky top-0 z-10 border-b border-[#141119] bg-[#1F1B26] text-[#8F879D]">
              <tr className="text-[10px] uppercase tracking-[0.13em]">
                <th className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={
                      visibleUnits.length > 0 &&
                      visibleUnits.every((unit) =>
                        selectedReportUnitIds.includes(unit.id),
                      )
                    }
                    onChange={(event) => {
                      if (event.target.checked) {
                        saveReportSelection(
                          Array.from(
                            new Set([
                              ...selectedReportUnitIds,
                              ...visibleUnits
                                .filter(
                                  (unit) =>
                                    unit.status !== "unregistered" &&
                                    unit.residentCount > 0,
                                )
                                .map((unit) => unit.id),
                            ]),
                          ),
                        );
                      } else {
                        const visibleIds = new Set(visibleUnits.map((unit) => unit.id));
                        saveReportSelection(
                          selectedReportUnitIds.filter((id) => !visibleIds.has(id)),
                        );
                      }
                    }}
                    className="size-4 accent-[#7553FF]"
                    aria-label="Select visible units"
                  />
                </th>
                <th className="px-3 py-2.5 font-semibold">Unit</th>
                <th className="px-3 py-2.5 font-semibold">Residents</th>
                <th className="px-3 py-2.5 font-semibold">Information</th>
                <th className="px-3 py-2.5 font-semibold">Attention</th>
                <th className="px-3 py-2.5 font-semibold">Workflow</th>
                <th className="px-3 py-2.5 font-semibold">Submitted</th>
                <th className="px-2 py-2.5"><span className="sr-only">Open details</span></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#141119] text-[#D6D0DC]">
              {visibleUnits.map((unit) => {
                const canOpen =
                  unit.status !== "unregistered" && unit.residentCount > 0;
                const active = selectedUnitId === unit.id;
                const selectedForReport = selectedReportUnitIds.includes(unit.id);
                const duplicateMatches = duplicateCandidatesByUnit.get(unit.id) ?? [];
                const model = duplicateUnitById.get(unit.id);
                const residents = model?.residents ?? [];
                const primaryResident = residents[0]?.fullName ?? "No resident details";
                const complete = dataCompleteByUnitId.get(unit.id) === true;
                const sharedIssues = sharedContactIssuesByUnitId.get(unit.id) ?? [];
                const contactState = contactStateByUnitId.get(unit.id) ?? null;
                const attentionItems = [
                  duplicateMatches.length > 0 ? "Possible duplicate" : null,
                  !complete ? "Missing information" : null,
                  contactState === "new_info" ? "New information" : null,
                  sharedIssues.length > 0 ? "Shared contact" : null,
                  contactState === "contacted" ? "Contacted" : null,
                ].filter((value): value is string => Boolean(value));
                const attentionLabel = attentionItems[0] ?? "Clear";
                const additionalAttention = Math.max(0, attentionItems.length - 1);

                return (
                  <tr
                    key={unit.id}
                    tabIndex={canOpen ? 0 : -1}
                    onClick={() => {
                      if (!canOpen) return;
                      if (!active) setPendingUnitId(unit.id);
                      router.push(
                        `/products/entry/communities/${communityId}/registration?unit=${encodeURIComponent(unit.id)}`,
                        { scroll: false },
                      );
                    }}
                    onKeyDown={(event) => {
                      if (!canOpen || (event.key !== "Enter" && event.key !== " ")) return;
                      event.preventDefault();
                      if (!active) setPendingUnitId(unit.id);
                      router.push(
                        `/products/entry/communities/${communityId}/registration?unit=${encodeURIComponent(unit.id)}`,
                        { scroll: false },
                      );
                    }}
                    className={`outline-none transition ${
                      canOpen ? "cursor-pointer hover:bg-white/[0.018]" : "opacity-55"
                    } ${
                      active
                        ? "bg-[rgba(117,83,255,0.075)] shadow-[inset_2px_0_0_#7553FF]"
                        : selectedForReport
                          ? "bg-[rgba(117,83,255,0.035)]"
                          : ""
                    }`}
                  >
                    <td className="px-3 py-2.5 align-middle">
                      <input
                        type="checkbox"
                        checked={selectedForReport}
                        disabled={!canOpen}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => toggleReportUnit(unit.id)}
                        className="size-4 accent-[#7553FF]"
                        aria-label={`Select ${unit.label}`}
                      />
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <p className="truncate font-semibold text-white" title={unit.label}>
                        {unit.label}
                      </p>
                      <p className="mt-1 truncate text-[10px] text-[#8F879D]">
                        {model?.reference || "No reference"}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <p className="truncate font-semibold text-white" title={primaryResident}>
                        {primaryResident}
                      </p>
                      <p className="mt-1 text-[10px] text-[#8F879D]">
                        {unit.residentCount} {unit.residentCount === 1 ? "resident" : "residents"}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <span
                        className={`inline-flex min-h-6 items-center rounded-[4px] border px-2 py-1 text-[10px] font-semibold ${
                          complete
                            ? "border-[rgba(103,215,165,0.20)] bg-[rgba(103,215,165,0.06)] text-[#8EE2B9]"
                            : "border-[rgba(243,202,87,0.22)] bg-[rgba(243,202,87,0.06)] text-[#F2D77B]"
                        }`}
                      >
                        {complete ? "Complete" : "Incomplete"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex min-h-6 items-center rounded-[4px] border px-2 py-1 text-[10px] font-semibold ${
                            attentionLabel === "Clear" || attentionLabel === "Contacted"
                              ? "border-white/10 bg-white/[0.025] text-[#C8C1CD]"
                              : "border-[rgba(243,202,87,0.22)] bg-[rgba(243,202,87,0.06)] text-[#F2D77B]"
                          }`}
                        >
                          {attentionLabel}
                        </span>
                        {additionalAttention > 0 ? (
                          <span className="text-[10px] text-[#8F879D]">+{additionalAttention}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <Badge tone={statusTone(unit.status)}>
                        {unitFilter === "resolved"
                          ? "Resolved duplicate"
                          : statusLabel(unit.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 align-top text-[#A9A3B2]">
                      {formatDate(unit.submittedAt)}
                    </td>
                    <td className="px-2 py-2.5 align-middle text-right">
                      {canOpen ? (
                        <ChevronRight
                          className={`ml-auto size-4 ${
                            active ? "text-[#D8D1FF]" : "text-[#8F879D]"
                          }`}
                          aria-hidden
                        />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {visibleUnits.length === 0 ? (
            <div className="grid min-h-56 place-items-center px-6 text-center">
              <div>
                <p className="text-sm font-semibold text-white">
                  No registrations match this view
                </p>
                <p className="mt-1 text-xs text-[#A9A3B2]">
                  Clear the search or filters to show household registrations again.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#141119] bg-[#1F1B26] px-4 py-2 text-[10px] text-[#8F879D]">
          <span>
            Showing {visibleUnits.length} record{visibleUnits.length === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={selectAllReportableUnits}
              className="font-semibold text-[#BEB4FF] hover:text-white"
            >
              Select all reportable
            </button>
            <span>{summary.currentResidentCount} residents · {summary.totalUnits} units</span>
          </div>
        </div>
      </section>

      {selectedUnit && selectedUnitId ? (
        <section className="fixed bottom-5 right-5 top-[76px] z-40 flex w-[560px] min-w-0 flex-col overflow-hidden rounded-[10px] border border-[#141119] bg-[#292431] shadow-[0_24px_70px_rgba(0,0,0,0.45)] max-xl:inset-x-0 max-xl:bottom-0 max-xl:top-[54px] max-xl:w-auto max-xl:rounded-none" aria-busy={detailPending}>
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#141119] px-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#BEB4FF]">
                Household review
              </p>
              <p className="mt-0.5 text-[10px] text-[#8F879D]">
                Review details and take the next workflow action.
              </p>
            </div>
            <Link
              href={`/products/entry/communities/${communityId}/registration`}
              scroll={false}
              className="grid size-8 place-items-center rounded-md border border-[#141119] bg-[#2E2936] text-[#8F879D] transition hover:text-white"
              aria-label="Close household review"
            >
              <X className="size-4" aria-hidden />
            </Link>
          </div>
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

                {residentContactIssues.length > 0 || selectedContactHistory.length > 0 ? (
                  <div
                    className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.055] p-4"
                    data-testid="resident-contact-panel"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-500/12 text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
                          <MessageCircle className="size-5" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                            Resident contact
                          </p>
                          <p className="mt-1 text-base font-semibold text-white">
                            WhatsApp follow-up
                          </p>
                          <p className="mt-1 text-xs leading-5 text-emerald-50/70">
                            Generated only from resident-actionable diagnostics. Internal duplicate and workflow signals are never included.
                          </p>
                        </div>
                      </div>

                      <div className="min-w-0 xl:w-[320px]">
                        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                          WhatsApp recipient
                        </label>
                        {contactCandidates.length > 0 ? (
                          <select
                            value={
                              effectiveContact ? String(effectiveContact.position) : ""
                            }
                            onChange={(event) =>
                              setSelectedContactPosition(event.target.value)
                            }
                            className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-400/40"
                          >
                            {contactCandidates.map((candidate) => (
                              <option
                                key={`${candidate.position}:${candidate.phone}`}
                                value={String(candidate.position)}
                              >
                                {candidate.fullName} · {candidate.phone}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="mt-1.5 rounded-lg border border-amber-400/20 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-100">
                            No usable phone is registered. Copy the message and contact the household manually.
                          </p>
                        )}
                      </div>
                    </div>

                    {latestSelectedContact ? (
                      <div
                        className={`mt-4 rounded-xl border px-4 py-3 ${
                          selectedHasNewContactIssues
                            ? "border-amber-400/25 bg-amber-500/[0.08]"
                            : "border-emerald-400/25 bg-emerald-500/[0.08]"
                        }`}
                        data-testid="resident-contact-status"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${
                              selectedHasNewContactIssues
                                ? "bg-amber-500/15 text-amber-200"
                                : "bg-emerald-500/15 text-emerald-200"
                            }`}
                          >
                            {selectedHasNewContactIssues ? (
                              <TriangleAlert className="size-4" aria-hidden />
                            ) : (
                              <Check className="size-4" aria-hidden />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white">
                              {selectedHasNewContactIssues
                                ? "New information needed"
                                : "Contacted via WhatsApp"}
                            </p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                              {formatDate(latestSelectedContact.contactedAt)} · Recipient:{" "}
                              {latestSelectedContact.recipientName}
                            </p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                              {latestSelectedContact.contactedByEmail
                                ? `Recorded by ${latestSelectedContact.contactedByEmail}`
                                : "Recorded by ENTRY operator"}
                            </p>
                            {selectedContactMatchesCurrentIssues ? (
                              <p className="mt-1 text-xs text-emerald-100/70">
                                The current follow-up issues were included in this contact.
                              </p>
                            ) : selectedHasNewContactIssues ? (
                              <p className="mt-1 text-xs text-amber-100/75">
                                The household has different or additional follow-up issues since the last contact.
                              </p>
                            ) : residentContactIssues.length === 0 ? (
                              <p className="mt-1 text-xs text-emerald-100/70">
                                There are no current resident follow-up issues.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {residentContactIssues.length > 0 ? (
                      <>
                        <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/15 p-4">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                            Message preview
                          </p>
                          <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-xs leading-5 text-white/85">
                            {residentContactMessage}
                          </pre>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            className="gap-2"
                            onClick={openResidentWhatsApp}
                            disabled={!effectiveContact}
                          >
                            <MessageCircle className="size-4" aria-hidden />
                            Open WhatsApp
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="gap-2"
                            onClick={() => void copyResidentContactMessage()}
                          >
                            <Copy className="size-4" aria-hidden />
                            {contactMessageCopied ? "Copied" : "Copy message"}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="gap-2"
                            onClick={markResidentWhatsAppContacted}
                            disabled={!effectiveContact || contactPending}
                            data-testid="mark-resident-contacted"
                          >
                            <Check className="size-4" aria-hidden />
                            {contactPending ? "Saving..." : "Mark as contacted"}
                          </Button>
                        </div>

                        {contactFeedback ? (
                          <p
                            className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
                              contactFeedback.tone === "success"
                                ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                                : "border-rose-400/20 bg-rose-500/10 text-rose-100"
                            }`}
                          >
                            {contactFeedback.text}
                          </p>
                        ) : null}
                      </>
                    ) : null}

                    {selectedContactHistory.length > 0 ? (
                      <div className="mt-4 border-t border-white/[0.07] pt-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                          Contact history
                        </p>
                        <div className="mt-2 space-y-2">
                          {selectedContactHistory.slice(0, 5).map((event) => (
                            <div
                              key={event.id}
                              className="flex flex-col gap-1 rounded-lg border border-white/[0.07] bg-black/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-white">
                                  {event.recipientName} · {event.recipientPhone}
                                </p>
                                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                                  {event.contactedByEmail
                                    ? `Recorded by ${event.contactedByEmail}`
                                    : "Recorded by ENTRY operator"}
                                </p>
                              </div>
                              <p className="shrink-0 text-[11px] text-[var(--text-muted)]">
                                {formatDate(event.contactedAt)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

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
      ) : null}

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
