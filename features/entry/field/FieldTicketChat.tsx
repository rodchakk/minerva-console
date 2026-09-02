"use client";

import Link from "next/link";
import {
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<FieldResetAccessResult | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    window.requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ block: "end" });
    });
  }, [messages.length]);

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

  return (
    <div className="flex min-h-[calc(100dvh-15rem)] flex-col">
      <section className="flex-1 space-y-3 pb-4" aria-label="Ticket conversation">
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

        {messages.map((message) => {
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
                  <span>{isStaff ? (isCurrentStaff ? "You" : "Minerva staff") : requesterName}</span>
                  <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-[var(--console-text)]">
                  {message.body}
                </p>
              </article>
            </div>
          );
        })}
        <div ref={endRef} className="h-1" />
      </section>

      <section className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-30 -mx-1 rounded-xl border border-[var(--console-border)] bg-[rgba(20,20,20,0.97)] p-2.5 shadow-2xl backdrop-blur md:bottom-3">
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

          {status === "open" ? (
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

          {status !== "resolved" ? (
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

        {confirmingReset ? (
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

        {resetResult?.code ? (
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
            onChange={(event) => {
              setBody(event.target.value);
              window.requestAnimationFrame(resizeComposer);
            }}
            onKeyDown={(event) => {
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
