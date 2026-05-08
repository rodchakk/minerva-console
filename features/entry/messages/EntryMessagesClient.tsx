"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  sendEntryMessageAction,
  type EntryMessageMode,
} from "@/features/entry/messages/actions";
import type { EntryMessagesCommunity } from "@/features/entry/messages/queries";

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

function ModeButton({
  active,
  description,
  label,
  onClick,
}: {
  active: boolean;
  description: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[24px] border p-4 text-left transition ${
        active
          ? "border-violet-400/30 bg-violet-500/12 shadow-[0_14px_30px_rgba(89,80,243,0.18)]"
          : "border-white/8 bg-white/4 hover:border-white/12 hover:bg-white/6"
      }`}
    >
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
    </button>
  );
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
    <label className="flex cursor-pointer items-start gap-3 rounded-[22px] border border-white/8 bg-white/4 px-4 py-3 transition hover:bg-white/6">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-violet-400"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-white">
            {community.name}
          </p>
          <Badge tone="success">Active</Badge>
        </div>
        {community.city ? (
          <p className="mt-1 text-sm text-[var(--text-muted)]">{community.city}</p>
        ) : null}
      </div>
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
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
          onClick={() => (isPending ? null : setConfirmationOpen(false))}
        />
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.42fr)_320px]">
        <div className="space-y-5">
          {loadError ? (
            <div className="rounded-[28px] border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
              {loadError}
            </div>
          ) : null}

          {publishSummary ? (
            <div className="rounded-[28px] border border-emerald-400/20 bg-emerald-500/10 p-5 shadow-[0_18px_50px_rgba(2,6,23,0.2)]">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="success">Message published</Badge>
                {publishSummary.communitiesReached !== null ? (
                  <p className="text-sm font-medium text-emerald-100">
                    Communities reached: {publishSummary.communitiesReached}
                  </p>
                ) : null}
              </div>
              {publishSummary.skippedCount !== null &&
              publishSummary.skippedCount > 0 ? (
                <p className="mt-3 text-sm text-amber-200">
                  Skipped inactive or missing communities: {publishSummary.skippedCount}
                </p>
              ) : null}
              {publishSummary.messageId ? (
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-emerald-200/70">
                  Message ID: {publishSummary.messageId}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                  Official ENTRY broadcast
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  Publish a Minerva message
                </h2>
              </div>
              <Badge tone="info">Audience targeting coming later</Badge>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {modeOptions.map((option) => (
                <ModeButton
                  key={option.value}
                  active={mode === option.value}
                  description={option.description}
                  label={option.label}
                  onClick={() => setMode(option.value)}
                />
              ))}
            </div>

            <div className="mt-6 space-y-5">
              {mode === "single" ? (
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-200">
                    Community
                  </span>
                  <select
                    value={communityId}
                    onChange={(event) => setCommunityId(event.target.value)}
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-[var(--primary)]"
                  >
                    <option value="">Select community</option>
                    {activeCommunities.map((community) => (
                      <option key={community.id} value={community.id}>
                        {getCommunityLabel(community)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {mode === "selected" ? (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        Active communities
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        Selected: {selectedCommunityIds.length}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          setSelectedCommunityIds(activeCommunities.map((community) => community.id))
                        }
                      >
                        Select all active
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setSelectedCommunityIds([])}
                      >
                        Clear selection
                      </Button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={communitySearch}
                    onChange={(event) => setCommunitySearch(event.target.value)}
                    placeholder="Search active communities"
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-[var(--primary)]"
                  />

                  <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                    {filteredActiveCommunities.map((community) => (
                      <CommunityChecklistRow
                        key={community.id}
                        checked={selectedCommunityIds.includes(community.id)}
                        community={community}
                        onToggle={() => toggleCommunity(community.id)}
                      />
                    ))}

                    {filteredActiveCommunities.length === 0 ? (
                      <div className="rounded-[24px] border border-dashed border-white/10 px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                        No active communities match this search.
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {mode === "all" ? (
                <div className="rounded-[26px] border border-amber-400/20 bg-amber-500/10 px-5 py-4">
                  <p className="text-sm font-semibold text-amber-100">
                    This message will be sent to all active ENTRY communities.
                  </p>
                  <p className="mt-2 text-sm text-amber-200/80">
                    Active communities: {activeCommunities.length}
                  </p>
                </div>
              ) : null}

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">Title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Official update title"
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-[var(--primary)]"
                />
              </label>

              <label className="block space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-200">Message</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {body.length} characters
                  </span>
                </div>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={8}
                  placeholder="Write the official message that will be sent to ENTRY communities."
                  className="w-full rounded-[24px] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-[var(--primary)]"
                />
              </label>

              {mode === "selected" && selectedCommunityNames.length > 0 ? (
                <div className="rounded-[24px] border border-white/8 bg-white/4 px-4 py-3">
                  <p className="text-sm font-semibold text-white">
                    Selected communities
                  </p>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">
                    {selectedCommunityNames.join(", ")}
                  </p>
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-[24px] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {errorMessage}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={handleOpenConfirmation}>
                  Publish message
                </Button>
                <p className="text-sm text-[var(--text-muted)]">
                  Push notifications are queued automatically where available.
                </p>
              </div>
            </div>
          </div>
        </div>

        <aside className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
          <h2 className="text-lg font-semibold text-white">How this works</h2>
          <div className="mt-5 space-y-3">
            {[
              "Send to one community",
              "Send to selected communities",
              "Send to all active communities",
              "Push notifications are queued automatically",
              "Messages expire after 90 days",
            ].map((item) => (
              <div
                key={item}
                className="rounded-[24px] border border-white/8 bg-white/4 px-4 py-3"
              >
                <p className="text-sm font-semibold text-white">{item}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[24px] border border-white/8 bg-[rgba(9,12,24,0.54)] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Reach
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {activeCommunities.length}
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Active communities available for publishing
            </p>
            {inactiveCommunities.length > 0 ? (
              <p className="mt-3 text-sm text-amber-200/80">
                {inactiveCommunities.length} inactive communities are visible as context
                but excluded from send targets.
              </p>
            ) : null}
          </div>
        </aside>
      </section>

      {confirmationOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-[32px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(14,18,40,0.98),rgba(8,12,28,0.98))] p-6 shadow-[0_28px_90px_rgba(2,6,23,0.42)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                  Confirm publish
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  {getConfirmationCopy()}
                </h3>
              </div>
              <Badge tone="info">{getModeLabel(mode)}</Badge>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-[24px] border border-white/8 bg-white/4 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Title preview
                </p>
                <p className="mt-2 text-base font-semibold text-white">{title.trim()}</p>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-white/4 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Message preview
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-100">
                  {body.trim()}
                </p>
              </div>

              <div className="rounded-[24px] border border-violet-400/16 bg-violet-500/10 px-4 py-3 text-sm text-violet-100">
                This will create an ENTRY community message and enqueue push
                notifications where available.
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                disabled={isPending}
                onClick={() => setConfirmationOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" disabled={isPending} onClick={handleConfirmPublish}>
                {isPending ? "Publishing..." : "Confirm publish"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
