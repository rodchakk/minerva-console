"use client";

import Link from "next/link";
import { Compass, Copy, ExternalLink, Plus, RefreshCw } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  createOutriderSession,
  type OutriderActionResult,
} from "@/features/entry/outrider/actions";
import {
  getOutriderProgressPercent,
  getOutriderStatusLabel,
  type OutriderStatus,
} from "@/features/entry/outrider/model";
import type {
  OutriderCommunityOption,
  OutriderListItem,
} from "@/features/entry/outrider/queries";

type OutriderWorkspaceProps = {
  communities: OutriderCommunityOption[];
  sessions: OutriderListItem[];
};

const initialActionState: OutriderActionResult | null = null;

function statusTone(status: OutriderStatus): "default" | "success" | "warning" | "info" {
  if (status === "approved") return "success";
  if (status === "ready_for_review") return "info";
  if (status === "needs_information") return "warning";
  return "default";
}

function formatDate(value: string | null) {
  if (!value) return "Not submitted";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      {children}
    </div>
  );
}

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  return (
    <Button type="button" onClick={copy} className="gap-2">
      <Copy className="h-4 w-4 stroke-[1.75]" />
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

function StartOutriderDialog({
  communities,
  onClose,
}: {
  communities: OutriderCommunityOption[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    createOutriderSession,
    initialActionState,
  );

  if (state?.success && state.data?.link) {
    return (
      <Overlay>
        <div className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl">
          <Badge tone="success">Outrider started</Badge>
          <h3 className="mt-4 text-xl font-semibold text-white">
            Secure intake link ready
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Share this link with the community contact. It collects setup
            information only and does not import live ENTRY records.
          </p>

          <label className="mt-5 block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Outrider link
            </span>
            <input
              readOnly
              value={state.data.link}
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 font-mono text-xs text-white outline-none"
            />
          </label>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Done
            </Button>
            <a href={state.data.link} target="_blank" rel="noreferrer">
              <Button type="button" variant="secondary" className="gap-2">
                <ExternalLink className="h-4 w-4 stroke-[1.75]" />
                Open
              </Button>
            </a>
            <CopyLinkButton url={state.data.link} />
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
          Outrider
        </p>
        <h3 className="mt-2 text-xl font-semibold text-white">
          Start community intake
        </h3>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          Choose an active community that does not already have an Outrider
          intake.
        </p>

        <label className="mt-5 block">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Community
          </span>
          <select
            name="community_id"
            required
            className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm text-white outline-none focus:border-violet-400/50"
          >
            <option value="">Select community</option>
            {communities.map((community) => (
              <option key={community.id} value={community.id}>
                {community.name} - {community.city}
              </option>
            ))}
          </select>
        </label>

        {state && !state.success ? (
          <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {state.error}
          </p>
        ) : null}

        {communities.length === 0 ? (
          <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Every active community already has an Outrider intake.
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || communities.length === 0}>
            {pending ? "Starting..." : "Start Outrider"}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}

function SessionRow({ session }: { session: OutriderListItem }) {
  return (
    <Link
      href={`/products/entry/outrider/${session.id}`}
      className="grid gap-3 border-b border-[var(--border)] px-5 py-4 transition-colors hover:bg-white/[0.025] last:border-b-0 md:grid-cols-[minmax(0,1.2fr)_150px_120px_120px]"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 truncate text-sm font-semibold text-white">
            {session.communityName}
          </p>
          <Badge tone={statusTone(session.status)}>
            {getOutriderStatusLabel(session.status)}
          </Badge>
        </div>
        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
          {session.communityCity} · {session.attachmentCount} attachments · updated{" "}
          {formatDate(session.updatedAt)}
        </p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Progress
        </p>
        <div className="mt-1 flex items-center gap-3">
          <p className="text-sm font-semibold text-white">
            {getOutriderProgressPercent(session.completedSections)}%
          </p>
          <div className="h-1 min-w-16 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-violet-400"
              style={{ width: `${getOutriderProgressPercent(session.completedSections)}%` }}
            />
          </div>
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Submitted
        </p>
        <p className="mt-1 text-xs text-slate-300">{formatDate(session.submittedAt)}</p>
      </div>
      <div className="flex items-center justify-end">
        <ExternalLink className="h-4 w-4 text-[var(--text-muted)]" />
      </div>
    </Link>
  );
}

export function OutriderWorkspace({
  communities,
  sessions,
}: OutriderWorkspaceProps) {
  const [showStart, setShowStart] = useState(false);
  const attentionCount = useMemo(
    () =>
      sessions.filter((session) =>
        ["ready_for_review", "needs_information"].includes(session.status),
      ).length,
    [sessions],
  );
  const openCount = useMemo(
    () => sessions.filter((session) => session.status !== "approved").length,
    [sessions],
  );
  const approvedCount = useMemo(
    () => sessions.filter((session) => session.status === "approved").length,
    [sessions],
  );

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-[var(--console-border)] bg-[var(--console-surface)]">
        <div className="relative min-h-[270px] overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('/entry/outrider/outrider-mountains.webp')",
            }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,8,12,0.98)_0%,rgba(7,8,12,0.88)_38%,rgba(7,8,12,0.38)_70%,rgba(7,8,12,0.16)_100%)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(0deg,rgba(7,8,12,0.72)_0%,transparent_48%)]"
          />

          <div className="relative z-10 flex min-h-[270px] flex-col justify-between p-6 sm:p-8 lg:p-9">
            <div className="flex items-start justify-between gap-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-300/10 text-violet-100 backdrop-blur-sm">
                <Compass className="h-6 w-6 stroke-[1.6]" />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  onClick={() => setShowStart(true)}
                  className="gap-2 shadow-lg shadow-black/20"
                >
                  <Plus className="h-4 w-4 stroke-[1.75]" />
                  Start Outrider
                </Button>
                <Link href="/products/entry">
                  <Button type="button" variant="secondary" className="gap-2 bg-black/30 backdrop-blur-sm">
                    <RefreshCw className="h-4 w-4 stroke-[1.75]" />
                    Operations
                  </Button>
                </Link>
              </div>
            </div>

            <div className="max-w-2xl pt-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-violet-200/90">
                ENTRY · Community intelligence
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-[0.08em] text-white sm:text-5xl">
                OUTRIDER
              </h1>
              <p className="mt-3 text-lg font-medium tracking-wide text-white/90 sm:text-xl">
                Collect. Structure. Prepare.
              </p>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                Gather community setup information and files, review progress,
                and prepare a clean handoff for ENTRY without importing live
                operational records.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid overflow-hidden rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] md:grid-cols-3">
        {[
          { label: "Open intakes", value: openCount },
          { label: "Need attention", value: attentionCount },
          { label: "Approved handoffs", value: approvedCount },
        ].map((metric, index) => (
          <div
            key={metric.label}
            className={`px-5 py-4 ${index < 2 ? "border-b border-[var(--console-border)] md:border-r md:border-b-0" : ""}`}
          >
            <p className="text-xs font-medium text-[var(--console-text-muted)]">
              {metric.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)]">
        <div className="flex flex-col gap-3 border-b border-[var(--console-border)] px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--console-text-muted)]">
              Intake queue
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">Outrider sessions</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--console-text-muted)]">
              Review incoming setup data and export approved handoff packages.
            </p>
          </div>
          <p className="text-xs text-[var(--console-text-muted)]">
            {sessions.length} total
          </p>
        </div>

        {sessions.length > 0 ? (
          <div>{sessions.map((session) => <SessionRow key={session.id} session={session} />)}</div>
        ) : (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-500/[0.08] text-violet-200">
              <Compass className="h-5 w-5 stroke-[1.7]" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">No Outrider intakes yet</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--console-text-muted)]">
              Start one for an active community and share the secure public link.
            </p>
            <Button
              type="button"
              onClick={() => setShowStart(true)}
              className="mt-5 gap-2"
            >
              <Plus className="h-4 w-4 stroke-[1.75]" />
              Start first Outrider
            </Button>
          </div>
        )}
      </section>

      {showStart ? (
        <StartOutriderDialog
          communities={communities}
          onClose={() => setShowStart(false)}
        />
      ) : null}
    </div>
  );
}
