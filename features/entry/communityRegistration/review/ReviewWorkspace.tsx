"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  confirmAndPrepareCommunityRegistrationActivation,
  createOrReplaceCommunityRegistrationCorrectionLink,
  markCommunityRegistrationUnitReviewed,
  requestCommunityRegistrationCorrection,
  type CommunityRegistrationReviewActionResult,
} from "@/features/entry/communityRegistration/review/actions";
import type {
  CommunityRegistrationReviewCampaign,
  CommunityRegistrationReviewSummary,
  CommunityRegistrationReviewUnit,
  CommunityRegistrationReviewUnitDetail,
} from "@/features/entry/communityRegistration/review/queries";

type ReviewWorkspaceProps = {
  campaign: CommunityRegistrationReviewCampaign;
  communityId: string;
  loadError: string | null;
  selectedUnit: CommunityRegistrationReviewUnitDetail | null;
  selectedUnitId: string | null;
  summary: CommunityRegistrationReviewSummary;
  units: CommunityRegistrationReviewUnit[];
};

const initialActionState: CommunityRegistrationReviewActionResult | null = null;

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
      return "Reviewed";
    case "confirmed":
      return "Patronato confirmed";
    case "processed":
      return "Prepared for activation";
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
  if (["reviewed", "confirmed", "processed"].includes(normalized)) return "success";
  if (["submitted", "review", "open"].includes(normalized)) return "info";
  if (["needs_correction", "edit_enabled", "paused"].includes(normalized)) {
    return "warning";
  }
  return "default";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
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
                <Button type="button">Ver en Activation Queue</Button>
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
          Patronato confirmation
        </p>
        <h3 className="mt-2 text-xl font-semibold text-white">
          Confirmar y preparar activación
        </h3>
        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
          Use this after Patronato has approved the resident information outside
          ENTRY. ENTRY will record that confirmation and prepare eligible
          residents in Activation Queue. It will not create users, PINs, or
          activation messages.
        </p>

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
          <Button type="submit" disabled={pending}>
            {pending ? "Preparing..." : "Confirmar y preparar activación"}
          </Button>
        </div>
      </form>
    </Overlay>
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
      label: "Reviewed",
    },
    {
      done: Boolean(selectedUnit.patronatoConfirmedAt),
      label: "Patronato confirmed",
    },
    {
      done: normalized === "processed",
      label: "Prepared for activation",
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

export function ReviewWorkspace({
  campaign,
  communityId,
  loadError,
  selectedUnit,
  selectedUnitId,
  summary,
  units,
}: ReviewWorkspaceProps) {
  const [showCorrectionRequest, setShowCorrectionRequest] = useState(false);
  const [correctionLinkMode, setCorrectionLinkMode] = useState<
    "create" | "replace" | null
  >(null);
  const [showActivationHandoff, setShowActivationHandoff] = useState(false);
  const [reviewState, reviewAction, reviewPending] = useActionState(
    markCommunityRegistrationUnitReviewed,
    initialActionState,
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
  const activationQueueUrl = `/products/entry/activation?community_id=${encodeURIComponent(
    communityId,
  )}`;
  const canConfirmAndPrepare = Boolean(
    selectedUnitId &&
      ((reviewCapable && ["reviewed", "confirmed"].includes(selectedStatus)) ||
        (campaignStatus === "confirmed" && selectedStatus === "confirmed")),
  );
  const isPreparedForActivation = selectedStatus === "processed";

  return (
    <div className="space-y-4">
      {loadError ? (
        <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {loadError}
        </div>
      ) : null}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
              Registration review
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              {campaign.publicTitle}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Review submitted household data before Patronato confirmation.
            </p>
          </div>
          <Badge tone={statusTone(campaign.status)}>{statusLabel(campaign.status)}</Badge>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Submitted" value={summary.submitted} />
          <Metric label="Reviewed" value={summary.reviewed} />
          <Metric label="Needs correction" value={summary.needsCorrection} />
          <Metric label="Correction open" value={summary.editEnabled} />
          <Metric label="Confirmed" value={summary.confirmed} />
          <Metric label="Residents" value={summary.currentResidentCount} />
        </div>

        {campaignStatus === "open" ? (
          <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-4 text-sm leading-6 text-amber-50/90">
            Registration is open. Submitted households can be reviewed and
            prepared for activation while other units continue registering.
          </p>
        ) : null}

        {campaignStatus === "paused" ? (
          <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-50/90">
            This campaign is paused. Resume the campaign before entering review.
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.4fr)]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
                Participating units
              </p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {summary.totalUnits} units · {summary.pendingObservations} pending observations
              </p>
            </div>
          </div>

          <div className="mt-4 max-h-[680px] space-y-2 overflow-y-auto pr-1">
            {units.map((unit) => {
              const canOpen = unit.status !== "unregistered" && unit.residentCount > 0;
              const active = selectedUnitId === unit.id;
              const content = (
                <>
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{unit.label}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {unit.residentCount} resident{unit.residentCount === 1 ? "" : "s"}
                        {unit.hasPendingObservation ? " · observation pending" : ""}
                      </p>
                    </div>
                    <Badge tone={statusTone(unit.status)}>{statusLabel(unit.status)}</Badge>
                  </div>
                </>
              );

              return canOpen ? (
                <Link
                  key={unit.id}
                  href={`/products/entry/communities/${communityId}/registration?unit=${encodeURIComponent(unit.id)}`}
                  className={`block rounded-xl border px-3 py-3 transition-colors ${
                    active
                      ? "border-violet-400/40 bg-violet-500/10"
                      : "border-[var(--border)] bg-[var(--surface-strong)] hover:border-white/15"
                  }`}
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={unit.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-3 opacity-70"
                >
                  {content}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:p-5">
          {!selectedUnit || !selectedUnitId ? (
            <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-strong)] px-6 py-10 text-center">
              <div>
                <p className="text-base font-semibold text-white">Select a submitted unit</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-muted)]">
                  Open a household to inspect its current submission and residents.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
                    Household submission
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    {selectedUnit.unitLabel}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Version {selectedUnit.version} · Submitted {formatDate(selectedUnit.submittedAt)}
                  </p>
                </div>
                <Badge tone={statusTone(selectedUnit.status)}>
                  {statusLabel(selectedUnit.status)}
                </Badge>
              </div>

              {selectedUnit.review?.observation ? (
                <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                    Current correction observation
                  </p>
                  <p className="mt-2 text-sm leading-6 text-amber-50/90">
                    {selectedUnit.review.observation}
                  </p>
                </div>
              ) : null}

              <HandoffProgress selectedUnit={selectedUnit} />

              <div className="mt-5 space-y-3">
                {selectedUnit.residents.map((resident) => (
                  <div
                    key={`${resident.position}-${resident.fullName}`}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {resident.position}. {resident.fullName}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">
                          {resident.relationshipToHouse}
                          {resident.isOwnerReference ? " · owner reference" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <p className="text-[var(--text-muted)]">
                        Email: <span className="text-white">{resident.email ?? "—"}</span>
                      </p>
                      <p className="text-[var(--text-muted)]">
                        Phone: <span className="text-white">{resident.phone ?? "—"}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {reviewState && !reviewState.success ? (
                <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {reviewState.error}
                </p>
              ) : null}

              {!reviewCapable && !isPreparedForActivation && !canConfirmAndPrepare ? (
                <p className="mt-5 text-sm leading-6 text-[var(--text-muted)]">
                  Review actions are read-only until the campaign can accept review.
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap justify-end gap-3">
                {isPreparedForActivation ? (
                  <Link href={activationQueueUrl}>
                    <Button type="button">Ver en Activation Queue</Button>
                  </Link>
                ) : null}

                {canRequestCorrection ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowCorrectionRequest(true)}
                  >
                    Request correction
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

                {canConfirmAndPrepare ? (
                  <Button
                    type="button"
                    onClick={() => setShowActivationHandoff(true)}
                    disabled={Boolean(loadError)}
                  >
                    Confirmar y preparar activación
                  </Button>
                ) : null}

                {canMarkReviewed ? (
                  <form action={reviewAction}>
                    <input type="hidden" name="campaign_unit_id" value={selectedUnitId} />
                    <input type="hidden" name="community_id" value={communityId} />
                    <Button type="submit" disabled={reviewPending || Boolean(loadError)}>
                      {reviewPending ? "Marking..." : "Mark reviewed"}
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>
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
          campaignId={campaign.id}
          communityId={communityId}
          onClose={() => setShowActivationHandoff(false)}
          unitId={selectedUnitId}
          unitLabel={selectedUnit.unitLabel}
        />
      ) : null}
    </div>
  );
}
