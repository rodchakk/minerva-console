"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import {
  Bell,
  CheckCircle2,
  Clock3,
  RadioTower,
  Search,
  Send,
} from "lucide-react";
import {
  sendEntryMessageAction,
  type EntryMessageMode,
} from "@/features/entry/messages/actions";
import type { EntryMessagesCommunity } from "@/features/entry/messages/queries";
import { cn } from "@/lib/supabase/utils";

type EntryMessagesClientProps = {
  communities: EntryMessagesCommunity[];
  loadError?: string | null;
};

type PublishSummary = {
  communitiesReached: number | null;
  messageId: string;
  skippedCount: number | null;
};

const modeOptions: Array<{
  description: string;
  label: string;
  value: EntryMessageMode;
}> = [
  {
    description: "Target one active community",
    label: "One community",
    value: "single",
  },
  {
    description: "Pick a focused group of communities",
    label: "Selected communities",
    value: "selected",
  },
  {
    description: "Broadcast across every active community",
    label: "All active communities",
    value: "all",
  },
];

function normalizeRpcResult(result: unknown) {
  if (Array.isArray(result)) {
    const first = result[0];
    return first && typeof first === "object"
      ? (first as Record<string, unknown>)
      : {};
  }

  return result && typeof result === "object"
    ? (result as Record<string, unknown>)
    : {};
}

function coerceNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function coerceString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function extractPublishSummary(result: unknown): PublishSummary {
  const record = normalizeRpcResult(result);

  return {
    communitiesReached:
      coerceNumber(record.communities_reached) ??
      coerceNumber(record.community_count) ??
      coerceNumber(record.sent_count),
    messageId:
      coerceString(record.message_id) ||
      coerceString(record.id) ||
      coerceString(record.entry_message_id),
    skippedCount:
      coerceNumber(record.skipped_inactive_or_missing) ??
      coerceNumber(record.skipped_count),
  };
}

function getModeLabel(mode: EntryMessageMode) {
  return modeOptions.find((option) => option.value === mode)?.label ?? mode;
}

function getCommunityLabel(community: EntryMessagesCommunity) {
  return community.city ? `${community.name} · ${community.city}` : community.name;
}

function CommunityChecklistRow({
  checked,
  community,
  onToggle,
}: {
  checked: boolean;
  community: EntryMessagesCommunity;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-[var(--console-border)] bg-[var(--console-surface-raised)] px-3.5 py-2.5 transition hover:bg-white/[0.035]">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-xs font-semibold text-white">
            {community.name}
          </p>
          <span className="inline-flex items-center rounded-[4px] border border-emerald-400/20 bg-emerald-500/[0.08] px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">
            Active
          </span>
        </div>
        {community.city ? (
          <p className="mt-0.5 truncate text-[11px] text-[var(--console-text-muted)]">
            {community.city}
          </p>
        ) : null}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="h-4 w-4 rounded border-[var(--console-border-strong)] bg-transparent text-[var(--console-accent)] focus:ring-0 focus:ring-offset-0"
      />
    </label>
  );
}

export function EntryMessagesClient({
  communities,
  loadError,
}: EntryMessagesClientProps) {
  const [mode, setMode] = useState<EntryMessageMode>("single");
  const [communityId, setCommunityId] = useState("");
  const [selectedCommunityIds, setSelectedCommunityIds] = useState<string[]>([]);
  const [communitySearch, setCommunitySearch] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [publishSummary, setPublishSummary] = useState<PublishSummary | null>(null);
  const [isPending, startTransition] = useTransition();
  const deferredCommunitySearch = useDeferredValue(communitySearch);

  const activeCommunities = useMemo(
    () => communities.filter((community) => community.isActive),
    [communities],
  );
  const inactiveCommunities = useMemo(
    () => communities.filter((community) => !community.isActive),
    [communities],
  );
  const selectedCommunity = activeCommunities.find(
    (community) => community.id === communityId,
  );
  const normalizedSearch = deferredCommunitySearch.trim().toLowerCase();
  const filteredActiveCommunities = activeCommunities.filter((community) => {
    if (!normalizedSearch) {
      return true;
    }

    return (
      community.name.toLowerCase().includes(normalizedSearch) ||
      community.city.toLowerCase().includes(normalizedSearch)
    );
  });

  const selectedCommunityNames = activeCommunities
    .filter((community) => selectedCommunityIds.includes(community.id))
    .map(getCommunityLabel);

  function toggleCommunity(communityTargetId: string) {
    setSelectedCommunityIds((current) =>
      current.includes(communityTargetId)
        ? current.filter((id) => id !== communityTargetId)
        : [...current, communityTargetId],
    );
  }

  function getConfirmationCopy() {
    if (mode === "single") {
      return `Publish this message to ${selectedCommunity?.name ?? "this community"}?`;
    }

    if (mode === "selected") {
      return `Publish this message to ${selectedCommunityIds.length} selected communities?`;
    }

    return "Publish this message to all active ENTRY communities?";
  }

  function handleOpenConfirmation() {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    setErrorMessage(null);
    setPublishSummary(null);

    if (!trimmedTitle) {
      setErrorMessage("Title is required.");
      return;
    }

    if (!trimmedBody) {
      setErrorMessage("Message body is required.");
      return;
    }

    if (mode === "single" && !communityId) {
      setErrorMessage("Select a community before publishing.");
      return;
    }

    if (mode === "selected" && selectedCommunityIds.length < 1) {
      setErrorMessage("Select at least one community before publishing.");
      return;
    }

    setConfirmationOpen(true);
  }

  function handleConfirmPublish() {
    startTransition(async () => {
      const result = await sendEntryMessageAction({
        body,
        communityId,
        communityIds: selectedCommunityIds,
        mode,
        title,
      });

      if (!result.success) {
        setConfirmationOpen(false);
        setErrorMessage(result.error ?? "Could not publish the message.");
        return;
      }

      setConfirmationOpen(false);
      setErrorMessage(null);
      setPublishSummary(extractPublishSummary(result.result));
      setTitle("");
      setBody("");

      if (mode === "single") {
        setCommunityId("");
      }

      if (mode === "selected") {
        setSelectedCommunityIds([]);
        setCommunitySearch("");
      }
    });
  }

  return (
    <>
      {confirmationOpen ? (
        <button
          type="button"
          aria-label="Close publish confirmation"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => (isPending ? null : setConfirmationOpen(false))}
        />
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {loadError ? (
            <div className="rounded-md border border-rose-400/20 bg-rose-500/10 p-4 text-xs font-medium text-rose-200">
              {loadError}
            </div>
          ) : null}

          {publishSummary ? (
            <div className="rounded-md border border-emerald-400/20 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 stroke-[1.75] text-emerald-400" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">
                  Message published
                </p>
              </div>
              {publishSummary.communitiesReached !== null ? (
                <p className="mt-1.5 text-xs font-medium text-emerald-100">
                  Communities reached: {publishSummary.communitiesReached}
                </p>
              ) : null}
              {publishSummary.skippedCount !== null &&
              publishSummary.skippedCount > 0 ? (
                <p className="mt-1 text-xs text-amber-200">
                  Skipped inactive or missing communities: {publishSummary.skippedCount}
                </p>
              ) : null}
              {publishSummary.messageId ? (
                <p className="mt-2 text-[10px] font-mono uppercase tracking-[0.16em] text-emerald-200/70">
                  Message ID: {publishSummary.messageId}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-6 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-5 lg:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--console-text-muted)]">
                  Official ENTRY broadcast
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  Publish a Minerva message
                </h2>
              </div>
              <span className="inline-flex items-center rounded-[4px] border border-violet-400/15 bg-violet-500/[0.08] px-2 py-0.5 text-[11px] font-semibold text-violet-200">
                Audience targeting coming later
              </span>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--console-text-muted)]">
                Audience
              </label>
              <nav
                aria-label="Audience selector"
                className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface-raised)] p-1"
              >
                {modeOptions.map((option) => {
                  const isActive = mode === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMode(option.value)}
                      className={cn(
                        "inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50",
                        isActive
                          ? "bg-[var(--console-accent-subtle)] text-violet-100 ring-1 ring-inset ring-[var(--console-accent-border)]"
                          : "text-[var(--console-text-muted)] hover:bg-white/[0.035] hover:text-slate-100",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </nav>
              <p className="text-xs text-[var(--console-text-muted)]">
                {modeOptions.find((opt) => opt.value === mode)?.description}
              </p>
            </div>

            {mode === "single" ? (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--console-text-muted)]">
                  Community
                </label>
                <select
                  value={communityId}
                  onChange={(event) => setCommunityId(event.target.value)}
                  className="h-9 w-full rounded-md border border-[var(--console-border)] bg-[var(--console-surface-raised)] px-3 text-sm text-slate-100 outline-none transition focus:border-[var(--console-accent-border)]"
                >
                  <option value="">Select community</option>
                  {activeCommunities.map((community) => (
                    <option key={community.id} value={community.id}>
                      {getCommunityLabel(community)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {mode === "selected" ? (
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--console-text-muted)]">
                      Active communities
                    </p>
                    <p className="mt-0.5 text-xs text-slate-300">
                      Selected: {selectedCommunityIds.length} of {activeCommunities.length}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCommunityIds(activeCommunities.map((c) => c.id))
                      }
                      className="inline-flex h-7 items-center rounded-md border border-[var(--console-border)] bg-white/[0.025] px-2.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.05]"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCommunityIds([])}
                      className="inline-flex h-7 items-center rounded-md px-2.5 text-xs font-semibold text-[var(--console-text-muted)] hover:bg-white/[0.04] hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.75] text-[var(--console-text-soft)]" />
                  <input
                    type="text"
                    value={communitySearch}
                    onChange={(event) => setCommunitySearch(event.target.value)}
                    placeholder="Search active communities"
                    className="h-8 w-full rounded-md border border-[var(--console-border)] bg-[var(--console-surface-raised)] pl-8 pr-3 text-xs text-slate-100 outline-none transition placeholder:text-[var(--console-text-soft)] focus:border-[var(--console-accent-border)]"
                  />
                </div>

                <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                  {filteredActiveCommunities.map((community) => (
                    <CommunityChecklistRow
                      key={community.id}
                      checked={selectedCommunityIds.includes(community.id)}
                      community={community}
                      onToggle={() => toggleCommunity(community.id)}
                    />
                  ))}

                  {filteredActiveCommunities.length === 0 ? (
                    <div className="rounded-md border border-dashed border-[var(--console-border-strong)] p-4 text-center text-xs text-[var(--console-text-muted)]">
                      No active communities match this search.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {mode === "all" ? (
              <div className="rounded-md border border-amber-400/20 bg-amber-500/[0.08] px-4 py-3">
                <p className="text-xs font-semibold text-amber-200">
                  Broadcasting to all {activeCommunities.length} active ENTRY communities.
                </p>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--console-text-muted)]">
                Title
              </label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Official update title"
                className="h-9 w-full rounded-md border border-[var(--console-border)] bg-[var(--console-surface-raised)] px-3 text-sm text-slate-100 outline-none transition placeholder:text-[var(--console-text-soft)] focus:border-[var(--console-accent-border)]"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--console-text-muted)]">
                  Message
                </label>
                <span className="text-xs text-[var(--console-text-muted)]">
                  {body.length} characters
                </span>
              </div>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={7}
                placeholder="Write the official message that will be sent to ENTRY communities."
                className="w-full rounded-md border border-[var(--console-border)] bg-[var(--console-surface-raised)] p-3 text-sm text-slate-100 outline-none transition placeholder:text-[var(--console-text-soft)] focus:border-[var(--console-accent-border)]"
              />
            </div>

            {mode === "selected" && selectedCommunityNames.length > 0 ? (
              <div className="rounded-md border border-[var(--console-border)] bg-[var(--console-surface-raised)] px-3.5 py-2.5">
                <p className="text-xs font-semibold text-slate-200">
                  Selected communities ({selectedCommunityNames.length})
                </p>
                <p className="mt-1 text-xs text-[var(--console-text-muted)] line-clamp-2">
                  {selectedCommunityNames.join(", ")}
                </p>
              </div>
            ) : null}

            {errorMessage ? (
              <div className="rounded-md border border-rose-400/20 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-200">
                {errorMessage}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleOpenConfirmation}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--console-accent)] px-4 text-xs font-semibold text-white transition-colors hover:bg-[var(--console-accent-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50"
              >
                <Send className="h-3.5 w-3.5 stroke-[1.75]" />
                <span>Publish message</span>
              </button>
              <p className="text-xs text-[var(--console-text-muted)]">
                Push notifications are queued automatically where available.
              </p>
            </div>
          </div>
        </div>

        <aside className="h-fit space-y-6 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--console-text-muted)]">
              PUBLISHING CONTEXT
            </p>
            <h3 className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-white">
              How this works
            </h3>
            <ol className="mt-3 space-y-2 text-xs text-slate-300">
              <li className="flex items-start gap-2.5">
                <span className="font-mono text-[10px] font-semibold text-[var(--console-text-muted)]">
                  01
                </span>
                <span>Send to one community</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-mono text-[10px] font-semibold text-[var(--console-text-muted)]">
                  02
                </span>
                <span>Send to selected communities</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-mono text-[10px] font-semibold text-[var(--console-text-muted)]">
                  03
                </span>
                <span>Send to all active communities</span>
              </li>
            </ol>

            <div className="my-4 border-t border-[var(--console-border)]" />

            <ul className="space-y-2.5 text-xs text-[var(--console-text-muted)]">
              <li className="flex items-center gap-2">
                <Bell className="h-3.5 w-3.5 shrink-0 stroke-[1.75] text-violet-300" />
                <span>Push notifications queue automatically</span>
              </li>
              <li className="flex items-center gap-2">
                <Clock3 className="h-3.5 w-3.5 shrink-0 stroke-[1.75] text-[var(--console-text-muted)]" />
                <span>Messages expire after 90 days</span>
              </li>
            </ul>
          </div>

          <div className="border-t border-[var(--console-border)] pt-5 text-center">
            <div className="flex items-center justify-center gap-2">
              <RadioTower className="h-3.5 w-3.5 stroke-[1.75] text-emerald-400" />
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-white">
                Reach
              </h3>
            </div>
            <div className="mt-3">
              <p className="text-3xl font-semibold tracking-tight text-white">
                {activeCommunities.length}
              </p>
              <p className="mt-1 text-xs text-[var(--console-text-muted)]">
                Active communities available for publishing
              </p>
            </div>

            {inactiveCommunities.length > 0 ? (
              <p className="mt-3 text-xs leading-5 text-amber-300/80">
                {inactiveCommunities.length} inactive community{" "}
                {inactiveCommunities.length === 1 ? "is" : "are"} excluded from send
                targets.
              </p>
            ) : null}
          </div>
        </aside>
      </section>

      {confirmationOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl space-y-5 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface-raised)] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">
                  Confirm publish
                </p>
                <h3 className="mt-1 text-xl font-semibold text-white">
                  {getConfirmationCopy()}
                </h3>
              </div>
              <span className="inline-flex items-center rounded-[4px] border border-violet-400/15 bg-violet-500/[0.08] px-2 py-0.5 text-[11px] font-semibold text-violet-200">
                {getModeLabel(mode)}
              </span>
            </div>

            <div className="space-y-3">
              <div className="rounded-md border border-[var(--console-border)] bg-white/[0.015] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
                  Title preview
                </p>
                <p className="mt-1 text-sm font-semibold text-white">{title.trim()}</p>
              </div>

              <div className="rounded-md border border-[var(--console-border)] bg-white/[0.015] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
                  Message preview
                </p>
                <p className="max-h-48 overflow-y-auto mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-200">
                  {body.trim()}
                </p>
              </div>

              <div className="rounded-md border border-violet-400/15 bg-violet-500/[0.08] px-3.5 py-2.5 text-xs text-violet-100">
                This will create an ENTRY community message and enqueue push
                notifications where available.
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setConfirmationOpen(false)}
                className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--console-border)] bg-transparent px-3 text-xs font-semibold text-[var(--console-text-muted)] transition-colors hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmPublish}
                className="inline-flex h-8 items-center justify-center gap-2 rounded-md bg-[var(--console-accent)] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--console-accent-hover)] disabled:opacity-50"
              >
                {isPending ? "Publishing..." : "Confirm publish"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
