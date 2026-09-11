"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  FileDown,
  RefreshCw,
  RotateCw,
} from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  approveOutriderSession,
  recoverOutriderLink,
  requestOutriderInformation,
  rotateOutriderLink,
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

function ApproveDialog({
  onClose,
  outriderId,
}: {
  onClose: () => void;
  outriderId: string;
}) {
  const [state, formAction, pending] = useActionState(
    approveOutriderSession,
    initialActionState,
  );

  if (state?.success) {
    return (
      <Overlay>
        <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl">
          <Badge tone="success">Approved</Badge>
          <h3 className="mt-4 text-xl font-semibold text-white">
            Outrider approved
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            The handoff package can now be downloaded. No live ENTRY operational
            records were created.
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
        className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
          Approve handoff
        </p>
        <h3 className="mt-2 text-xl font-semibold text-white">
          Approve Outrider for setup handoff
        </h3>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          Approval records that the intake is ready for manual onboarding. It
          does not import units, destinations, residents, staff, or files into
          live ENTRY operations.
        </p>
        <input type="hidden" name="outrider_id" value={outriderId} />

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
            <CheckCircle2 className="h-4 w-4 stroke-[1.75]" />
            {pending ? "Approving..." : "Approve"}
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

export function OutriderDetailWorkspace({ detail }: { detail: OutriderDetail }) {
  const [showRequestInfo, setShowRequestInfo] = useState(false);
  const [showApprove, setShowApprove] = useState(false);
  const canApprove = detail.status === "ready_for_review";
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
            {canApprove ? (
              <Button type="button" onClick={() => setShowApprove(true)} className="gap-2">
                <CheckCircle2 className="h-4 w-4 stroke-[1.75]" />
                Approve
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
                  <p className="text-[var(--text-muted)]">
                    Other: {detail.otherUnitType ?? "None"}
                  </p>
                  <p className="text-[var(--text-muted)]">
                    Naming: {detail.unitNamingExample ?? "Not provided"}
                  </p>
                </div>
              }
            />
            <DataCard
              label={getOutriderSectionLabel("destinations")}
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
              label="Establecimientos"
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
                  {detail.securityStaffNotes ? (
                    <p className="text-[var(--text-muted)]">
                      Notes: {detail.securityStaffNotes}
                    </p>
                  ) : null}
                </div>
              }
            />
            <DataCard
              label={getOutriderSectionLabel("contact")}
              value={
                <div className="space-y-1">
                  <p>{detail.contactName ?? "No contact name"}</p>
                  <p className="text-[var(--text-muted)]">
                    {detail.contactPhone ?? "No phone"}
                  </p>
                  <p className="text-[var(--text-muted)]">
                    {detail.contactEmail ?? "No email"}
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

      {showApprove ? (
        <ApproveDialog onClose={() => setShowApprove(false)} outriderId={detail.id} />
      ) : null}
    </div>
  );
}
