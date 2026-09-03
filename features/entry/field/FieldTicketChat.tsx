"use client";

import Link from "next/link";
import {
  ArrowDown,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  KeyRound,
  Loader2,
  RotateCcw,
  Send,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  resetFieldResidentAccess,
  type FieldResetAccessResult,
} from "@/features/entry/field/peopleActions";
import {
  sendFieldTicketMessage,
  updateFieldTicketStatus,
} from "@/features/entry/field/ticketActions";

type TicketStatus = "open" | "in_progress" | "resolved";

type ChatMessage = {
  id: string;
  authorId: string;
  authorType: "staff" | "user";
  body: string;
  createdAt: string;
};

type TicketRequester = {
  email: string;
  fullName: string;
  role: string;
  userId: string;
};

type FieldTicketChatProps = {
  communityId: string | null;
  currentStaffUserId: string;
  description: string;
  isReadOnlyPreview: boolean;
  messages: ChatMessage[];
  requester: TicketRequester | null;
  requesterName: string;
  status: TicketStatus;
  ticketId: string;
};

type ViewportFrame = {
  height: number;
  top: number;
};

const FIELD_COMPOSER_MODE_EVENT = "minerva-field-composer-mode";
const LIVE_BACKUP_REFRESH_MS = 2000;

function formatMessageTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(date);
}

function getViewportFrame(): ViewportFrame {
  if (typeof window === "undefined") {
    return { height: 0, top: 0 };
  }

  const viewport = window.visualViewport;
  return {
    height: Math.max(280, Math.round(viewport?.height ?? window.innerHeight)),
    top: Math.max(0, Math.round(viewport?.offsetTop ?? 0)),
  };
}

function normalizeStatus(value: unknown): TicketStatus | null {
  if (value === "open" || value === "in_progress" || value === "resolved") {
    return value;
  }
  return null;
}

function mapLiveMessage(value: unknown): ChatMessage | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  const authorId = typeof record.author_id === "string" ? record.author_id : "";
  const body = typeof record.body === "string" ? record.body : "";
  const createdAt = typeof record.created_at === "string" ? record.created_at : "";
  const authorType = record.author_type;

  if (!id || !body || !createdAt || (authorType !== "staff" && authorType !== "user")) {
    return null;
  }

  return {
    id,
    authorId,
    authorType,
    body,
    createdAt,
  };
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map<string, ChatMessage>();
  for (const message of current) byId.set(message.id, message);
  for (const message of incoming) byId.set(message.id, message);
  return Array.from(byId.values()).sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return aTime - bTime;
  });
}

export function FieldTicketChat({
  communityId,
  currentStaffUserId,
  description,
  isReadOnlyPreview,
  messages,
  requester,
  requesterName,
  status,
  ticketId,
}: FieldTicketChatProps) {
  const router = useRouter();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const conversationRef = useRef<HTMLElement | null>(null);
  const previousMessageCountRef = useRef(messages.length);
  const hasMountedMessagesRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const composerEntryScrollTopRef = useRef(0);
  const [liveMessages, setLiveMessages] = useState(messages);
  const [liveStatus, setLiveStatus] = useState<TicketStatus>(status);
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<FieldResetAccessResult | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [copied, setCopied] = useState(false);
  const [composerMode, setComposerMode] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [normalHeight, setNormalHeight] = useState<number | null>(null);
  const [viewportFrame, setViewportFrame] = useState<ViewportFrame>({
    height: 0,
    top: 0,
  });
  const [isPending, startTransition] = useTransition();

  function scrollConversationToBottom(behavior: ScrollBehavior = "smooth") {
    const conversation = conversationRef.current;
    if (!conversation) return;
    conversation.scrollTo({ top: conversation.scrollHeight, behavior });
    isNearBottomRef.current = true;
    setHasNewMessage(false);
  }

  useEffect(() => {
    setLiveMessages((current) => mergeMessages(current, messages));
  }, [messages]);

  useEffect(() => {
    setLiveStatus(status);
  }, [status]);

  useEffect(() => {
    if (!hasMountedMessagesRef.current) {
      hasMountedMessagesRef.current = true;
      previousMessageCountRef.current = liveMessages.length;
      window.requestAnimationFrame(() => scrollConversationToBottom("auto"));
      return;
    }

    const previousCount = previousMessageCountRef.current;
    previousMessageCountRef.current = liveMessages.length;

    if (liveMessages.length <= previousCount) return;

    if (isNearBottomRef.current) {
      window.requestAnimationFrame(() => scrollConversationToBottom("smooth"));
    } else {
      setHasNewMessage(true);
    }
  }, [liveMessages.length]);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<ReturnType<typeof createBrowserSupabaseClient>["channel"]> | null = null;
    let backupTimer: number | null = null;
    const supabase = createBrowserSupabaseClient();

    const refreshFromDatabase = async () => {
      if (cancelled || document.visibilityState === "hidden") return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      const [messageResult, ticketResult] = await Promise.all([
        supabase
          .from("support_ticket_messages")
          .select("id,ticket_id,author_id,author_type,body,created_at")
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: true }),
        supabase.from("support_tickets").select("status").eq("id", ticketId).maybeSingle(),
      ]);

      if (cancelled) return;

      if (!messageResult.error && Array.isArray(messageResult.data)) {
        const freshMessages = messageResult.data
          .map(mapLiveMessage)
          .filter((message): message is ChatMessage => message !== null);
        setLiveMessages(freshMessages);
      }

      const nextStatus = normalizeStatus(ticketResult.data?.status);
      if (!ticketResult.error && nextStatus) {
        setLiveStatus(nextStatus);
      }
    };

    const startLiveUpdates = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        await supabase.realtime.setAuth(data.session.access_token);
      }
      if (cancelled) return;

      channel = supabase
        .channel(`field-ticket-v2-${ticketId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "support_ticket_messages",
            filter: `ticket_id=eq.${ticketId}`,
          },
          (payload) => {
            const message = mapLiveMessage(payload.new);
            if (message) {
              setLiveMessages((current) => mergeMessages(current, [message]));
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "support_tickets",
            filter: `id=eq.${ticketId}`,
          },
          (payload) => {
            const nextStatus = normalizeStatus(
              payload.new && typeof payload.new === "object"
                ? (payload.new as Record<string, unknown>).status
                : null,
            );
            if (nextStatus) setLiveStatus(nextStatus);
            router.refresh();
          },
        )
        .subscribe((subscriptionStatus) => {
          if (subscriptionStatus === "CHANNEL_ERROR" || subscriptionStatus === "TIMED_OUT") {
            void refreshFromDatabase();
          }
        });

      await refreshFromDatabase();
      backupTimer = window.setInterval(() => {
        void refreshFromDatabase();
      }, LIVE_BACKUP_REFRESH_MS);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshFromDatabase();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    void startLiveUpdates();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (backupTimer !== null) window.clearInterval(backupTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router, ticketId]);

  useEffect(() => {
    if (composerMode) return;

    const syncNormalHeight = () => {
      const shell = shellRef.current;
      if (!shell) return;

      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportBottom = viewportTop + viewportHeight;
      const shellTop = Math.max(shell.getBoundingClientRect().top, viewportTop + 8);
      const nav = document.querySelector<HTMLElement>("[data-field-nav]");
      const navHeight = nav?.getBoundingClientRect().height ?? 86;
      const available = viewportBottom - shellTop - navHeight - 10;
      const nextHeight = Math.max(320, Math.min(736, Math.round(available)));
      setNormalHeight(nextHeight);
    };

    const viewport = window.visualViewport;
    syncNormalHeight();
    viewport?.addEventListener("resize", syncNormalHeight);
    viewport?.addEventListener("scroll", syncNormalHeight);
    window.addEventListener("resize", syncNormalHeight);
    window.addEventListener("scroll", syncNormalHeight, { passive: true });

    return () => {
      viewport?.removeEventListener("resize", syncNormalHeight);
      viewport?.removeEventListener("scroll", syncNormalHeight);
      window.removeEventListener("resize", syncNormalHeight);
      window.removeEventListener("scroll", syncNormalHeight);
    };
  }, [composerMode]);

  useEffect(() => {
    if (!composerMode) return;

    const previousBodyOverflow = document.body.style.overflow;
    const viewport = window.visualViewport;
    const syncViewport = () => setViewportFrame(getViewportFrame());

    syncViewport();
    document.body.style.overflow = "hidden";
    window.dispatchEvent(
      new CustomEvent(FIELD_COMPOSER_MODE_EVENT, { detail: { open: true } }),
    );

    viewport?.addEventListener("resize", syncViewport);
    viewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);

    window.requestAnimationFrame(() => {
      const conversation = conversationRef.current;
      if (conversation) conversation.scrollTop = composerEntryScrollTopRef.current;
    });

    return () => {
      viewport?.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
      document.body.style.overflow = previousBodyOverflow;
      window.dispatchEvent(
        new CustomEvent(FIELD_COMPOSER_MODE_EVENT, { detail: { open: false } }),
      );
    };
  }, [composerMode]);

  function enterComposerMode() {
    composerEntryScrollTopRef.current = conversationRef.current?.scrollTop ?? 0;
    setViewportFrame(getViewportFrame());
    setComposerMode(true);
  }

  function leaveComposerModeAfterBlur() {
    window.setTimeout(() => {
      if (document.activeElement !== textareaRef.current) {
        setComposerMode(false);
      }
    }, 80);
  }

  function resizeComposer() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  }

  function handleSend() {
    const message = body.trim();
    if (!message || isPending || isReadOnlyPreview) return;

    setNotice(null);
    startTransition(async () => {
      const result = await sendFieldTicketMessage({ ticketId, body: message });
      if (!result.success) {
        setNotice(result.error || "Could not send message.");
        return;
      }

      setBody("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      isNearBottomRef.current = true;
      router.refresh();
    });
  }

  function handleStatus(nextStatus: TicketStatus) {
    if (isPending || isReadOnlyPreview) return;
    setNotice(null);
    startTransition(async () => {
      const result = await updateFieldTicketStatus({ ticketId, status: nextStatus });
      if (!result.success) {
        setNotice(result.error || "Could not update ticket status.");
        return;
      }
      setLiveStatus(nextStatus);
      router.refresh();
    });
  }

  function handleResetAccess() {
    if (!communityId || !requester || isPending || isReadOnlyPreview) return;
    setNotice(null);
    setResetResult(null);

    startTransition(async () => {
      const result = await resetFieldResidentAccess({
        communityId,
        userId: requester.userId,
      });
      setResetResult(result);
      setConfirmingReset(false);

      if (!result.success) {
        setNotice(result.error || "Could not reset access.");
        return;
      }

      setNotice(
        result.mode === "email"
          ? "Password reset email sent."
          : "Temporary recovery code generated.",
      );
    });
  }

  async function copyRecoveryCode() {
    if (!resetResult?.code) return;
    try {
      await navigator.clipboard.writeText(resetResult.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice("Could not copy recovery code.");
    }
  }

  const shellStyle = composerMode
    ? {
        height: viewportFrame.height || undefined,
        top: viewportFrame.top,
      }
    : normalHeight
      ? { height: normalHeight }
      : undefined;

  return (
    <div
      ref={shellRef}
      style={shellStyle}
      className={[
        "flex flex-col",
        composerMode
          ? "fixed inset-x-0 z-50 bg-[var(--console-bg)] px-3 pb-2 pt-2"
          : "h-[28rem] min-h-[20rem] max-h-[46rem]",
      ].join(" ")}
    >
      <section
        ref={conversationRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          const distanceFromBottom =
            element.scrollHeight - element.scrollTop - element.clientHeight;
          const nearBottom = distanceFromBottom < 96;
          isNearBottomRef.current = nearBottom;
          if (nearBottom) setHasNewMessage(false);
        }}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-1 pb-3"
        aria-label="Ticket conversation"
      >
        <div className="flex justify-start">
          <article className="max-w-[88%] rounded-2xl rounded-bl-md border border-[var(--console-border)] bg-[var(--console-surface)] px-4 py-3">
            <p className="text-xs font-bold text-[var(--console-text-soft)]">
              {requesterName} · Request
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-[var(--console-text)]">
              {description}
            </p>
          </article>
        </div>

        {liveMessages.map((message) => {
          const isStaff = message.authorType === "staff";
          const isCurrentStaff = isStaff && message.authorId === currentStaffUserId;
          return (
            <div
              key={message.id}
              className={`flex ${isStaff ? "justify-end" : "justify-start"}`}
            >
              <article
                className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                  isStaff
                    ? "rounded-br-md border border-[var(--console-accent-border)] bg-[var(--console-accent-subtle)]"
                    : "rounded-bl-md border border-[var(--console-border)] bg-[var(--console-surface)]"
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold text-[var(--console-text-soft)]">
                  <span>
                    {isStaff
                      ? isCurrentStaff
                        ? "You"
                        : "Minerva staff"
                      : requesterName}
                  </span>
                  <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-[var(--console-text)]">
                  {message.body}
                </p>
              </article>
            </div>
          );
        })}
      </section>

      {hasNewMessage ? (
        <div className="flex justify-center pb-2" aria-live="polite">
          <button
            type="button"
            onClick={() => scrollConversationToBottom("smooth")}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--console-accent-border)] bg-[var(--console-accent-subtle)] px-3 text-xs font-bold text-[var(--console-text)]"
          >
            <ArrowDown aria-hidden="true" className="h-4 w-4" />
            New message
          </button>
        </div>
      ) : null}

      <section className="flex-none rounded-xl border border-[var(--console-border)] bg-[rgba(20,20,20,0.97)] p-2.5 shadow-2xl backdrop-blur">
        {!composerMode ? (
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1" aria-label="Ticket quick actions">
            {communityId && requester ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingReset(true);
                    setResetResult(null);
                    setNotice(null);
                  }}
                  disabled={isPending || isReadOnlyPreview}
                  className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-[var(--console-border)] bg-white/5 px-3 text-xs font-bold text-[var(--console-text)] disabled:opacity-50"
                >
                  <KeyRound aria-hidden="true" className="h-4 w-4" />
                  Reset access
                </button>
                <Link
                  href={`/field/entry/communities/${encodeURIComponent(communityId)}/people/residents/${encodeURIComponent(requester.userId)}`}
                  className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-[var(--console-border)] bg-white/5 px-3 text-xs font-bold text-[var(--console-text)]"
                >
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  Open user
                </Link>
              </>
            ) : null}

            {liveStatus === "open" ? (
              <button
                type="button"
                onClick={() => handleStatus("in_progress")}
                disabled={isPending || isReadOnlyPreview}
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-[var(--console-border)] bg-white/5 px-3 text-xs font-bold text-[var(--console-text)] disabled:opacity-50"
              >
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                Start ticket
              </button>
            ) : null}

            {liveStatus !== "resolved" ? (
              <button
                type="button"
                onClick={() => handleStatus("resolved")}
                disabled={isPending || isReadOnlyPreview}
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 text-xs font-bold text-emerald-100 disabled:opacity-50"
              >
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                Resolve
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleStatus("open")}
                disabled={isPending || isReadOnlyPreview}
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-[var(--console-border)] bg-white/5 px-3 text-xs font-bold text-[var(--console-text)] disabled:opacity-50"
              >
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                Reopen
              </button>
            )}
          </div>
        ) : null}

        {!composerMode && confirmingReset ? (
          <div className="mb-2 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
            <p className="text-sm leading-5 text-amber-100">
              Reset access for {requester?.fullName ?? requesterName}? This will use the existing ENTRY recovery flow.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmingReset(false)}
                disabled={isPending}
                className="min-h-10 rounded-lg border border-amber-200/30 px-3 text-xs font-bold text-amber-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetAccess}
                disabled={isPending || isReadOnlyPreview}
                className="min-h-10 rounded-lg bg-amber-300 px-3 text-xs font-black text-slate-950 disabled:opacity-50"
              >
                Confirm reset
              </button>
            </div>
          </div>
        ) : null}

        {!composerMode && resetResult?.code ? (
          <div className="mb-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-100">
              Temporary recovery code
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <code className="break-all text-xl font-bold text-white">{resetResult.code}</code>
              <button
                type="button"
                onClick={copyRecoveryCode}
                className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-black text-slate-950"
              >
                <Clipboard aria-hidden="true" className="h-4 w-4" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ) : null}

        {notice ? (
          <p className="mb-2 rounded-lg border border-[var(--console-border)] bg-white/[0.04] px-3 py-2 text-xs leading-5 text-[var(--console-text-muted)]">
            {notice}
          </p>
        ) : null}

        {isReadOnlyPreview ? (
          <p className="mb-2 text-xs font-semibold text-amber-200">
            Preview is read-only. Messages and quick actions are disabled.
          </p>
        ) : null}

        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={body}
            maxLength={4000}
            onFocus={enterComposerMode}
            onBlur={leaveComposerModeAfterBlur}
            onChange={(event) => {
              setBody(event.target.value);
              window.requestAnimationFrame(resizeComposer);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.currentTarget.blur();
                return;
              }
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder="Reply to this ticket..."
            disabled={isPending || isReadOnlyPreview}
            className="max-h-32 min-h-12 flex-1 resize-none overflow-y-auto rounded-xl border border-[var(--console-border)] bg-black/30 px-3 py-3 text-base leading-6 text-[var(--console-text)] outline-none placeholder:text-[var(--console-text-soft)] focus:border-[var(--console-accent-border)] disabled:opacity-60"
          />
          <button
            type="button"
            aria-label="Send message"
            onPointerDown={(event) => event.preventDefault()}
            onClick={handleSend}
            disabled={!body.trim() || isPending || isReadOnlyPreview}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--console-accent)] text-white transition-opacity disabled:opacity-40"
          >
            {isPending ? (
              <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
            ) : (
              <Send aria-hidden="true" className="h-5 w-5" />
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
