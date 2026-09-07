"use client";

import Link from "next/link";
import { Copy, ExternalLink, Plus, RefreshCw } from "lucide-react";
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
          {session.communityCity} · {session.attachmentCount} attachments ·
          updated {formatDate(session.updatedAt)}
        </p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Progress
        </p>
        <p className="mt-1 text-sm font-semibold text-white">
          {getOutriderProgressPercent(session.completedSections)}%
        </p>
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

  return (
    <div className="space-y-5">
      <section className="px-0.5 pt-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">
              ENTRY OUTRIDER
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white lg:text-[2.05rem]">
              Community intelligence intake
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
              Collect setup facts and files from communities before ENTRY
              onboarding. Outrider is a handoff workspace, not an importer.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => setShowStart(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4 stroke-[1.75]" />
              Start Outrider
            </Button>
            <Link href="/products/entry">
              <Button type="button" variant="secondary" className="gap-2">
                <RefreshCw className="h-4 w-4 stroke-[1.75]" />
                Operations
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid overflow-hidden rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] md:grid-cols-3">
        {[
          { label: "Open intakes", value: openCount },
          { label: "Need attention", value: attentionCount },
          {
            label: "Approved handoffs",
            value: sessions.filter((session) => session.status === "approved").length,
          },
        ].map((metric, index) => (
          <div
            key={metric.label}
            className={`px-5 py-4 ${index < 2 ? "border-b border-[var(--console-border)] md:border-r md:border-b-0" : ""}`}
          >
            <p className="text-xs font-medium text-[var(--console-text-muted)]">
              {metric.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {metric.value}
            </p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)]">
        <div className="border-b border-[var(--console-border)] px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Outrider sessions</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--console-text-muted)]">
            Review incoming setup data and export approved handoff packages.
          </p>
        </div>

        {sessions.length > 0 ? (
          <div>{sessions.map((session) => <SessionRow key={session.id} session={session} />)}</div>
        ) : (
          <div className="px-5 py-12 text-center">
            <h3 className="text-lg font-semibold text-white">No Outrider intakes yet</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--console-text-muted)]">
              Start one for an active community and share the secure public link.
            </p>
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
