"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Send } from "lucide-react";
import { useFormStatus } from "react-dom";
import { replyToEntrySupportTicket } from "@/features/entry/support/actions";
import { cn } from "@/lib/supabase/utils";

type SupportConversationTicket = {
  createdAt: string;
  description: string;
  id: string;
  requesterName: string;
  ticketNumber: string;
};

type SupportConversationMessage = {
  authorType: "user" | "staff";
  body: string;
  createdAt: string;
  id: string;
};

type SupportConversationProps = {
  loadError: string | null;
  messages: SupportConversationMessage[];
  ticket: SupportConversationTicket;
};

function formatDateTime(value: string) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function SendReplyButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-violet-400/25 bg-violet-500/14 px-4 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Send className="h-4 w-4 stroke-[1.75]" />
      {pending ? "Sending..." : "Send"}
    </button>
  );
}

function MessageBubble({
  author,
  body,
  createdAt,
  staff,
}: {
  author: string;
  body: string;
  createdAt: string;
  staff: boolean;
}) {
  return (
    <div className={cn("flex", staff ? "justify-end" : "justify-start")}>
      <article
        className={cn(
          "max-w-[92%] rounded-md border px-3.5 py-3 sm:max-w-[76%]",
          staff
            ? "border-violet-400/28 bg-violet-500/14"
            : "border-[var(--border)] bg-[var(--surface-strong)]",
        )}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p
            className={cn(
              "text-[10px] font-semibold uppercase text-[var(--text-muted)]",
              staff ? "text-violet-200" : "",
            )}
          >
            {author}
          </p>
          <span className="text-[11px] text-[var(--text-soft)]">
            {formatDateTime(createdAt)}
          </span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-white">
          {body}
        </p>
      </article>
    </div>
  );
}

export function SupportConversation({
  loadError,
  messages,
  ticket,
}: SupportConversationProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const mountedRef = useRef(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const latestMessageKey = useMemo(() => {
    const latest = messages[messages.length - 1];
    return latest ? `${latest.id}:${latest.createdAt}` : ticket.createdAt;
  }, [messages, ticket.createdAt]);
  const messageCount = messages.length + 1;

  const isNearBottom = useCallback((node: HTMLDivElement) => {
    return node.scrollHeight - node.scrollTop - node.clientHeight < 96;
  }, []);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
    const node = scrollRef.current;
    if (!node) return;

    node.scrollTo({
      behavior,
      top: node.scrollHeight,
    });
    nearBottomRef.current = true;
    setHasNewMessages(false);
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    if (!mountedRef.current) {
      mountedRef.current = true;
      node.scrollTop = node.scrollHeight;
      nearBottomRef.current = true;
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      if (nearBottomRef.current) {
        scrollToLatest();
        return;
      }

      setHasNewMessages(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [latestMessageKey, scrollToLatest]);

  return (
    <section className="flex h-[clamp(560px,72vh,720px)] flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase text-violet-200">
            Conversation
          </p>
          <h2 className="mt-1 truncate text-base font-semibold text-white">
            Ticket activity
          </h2>
        </div>
        <p className="shrink-0 rounded-md border border-[var(--border)] bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)]">
          {messageCount} {messageCount === 1 ? "message" : "messages"}
        </p>
      </div>

      {loadError ? (
        <div className="mx-4 mt-4 rounded-md border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 sm:mx-5">
          Some messages could not be loaded.
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 border-t border-[var(--border)]">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto px-4 py-5 sm:px-5"
          onScroll={(event) => {
            const node = event.currentTarget;
            nearBottomRef.current = isNearBottom(node);
            if (nearBottomRef.current) setHasNewMessages(false);
          }}
        >
          <div className="space-y-9 pb-3">
            <MessageBubble
              author={ticket.requesterName}
              body={ticket.description}
              createdAt={ticket.createdAt}
              staff={false}
            />

            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                author={
                  message.authorType === "staff"
                    ? "Minerva Support"
                    : ticket.requesterName
                }
                body={message.body}
                createdAt={message.createdAt}
                staff={message.authorType === "staff"}
              />
            ))}
          </div>
        </div>

        {hasNewMessages ? (
          <button
            type="button"
            className="absolute bottom-3 left-1/2 inline-flex h-8 -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-3 text-xs font-semibold text-slate-100 shadow-[0_10px_28px_rgba(0,0,0,0.35)] transition hover:border-violet-400/24 hover:bg-[var(--surface-muted)]"
            onClick={() => scrollToLatest()}
          >
            New messages
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <form
        action={replyToEntrySupportTicket}
        className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-4 sm:px-5"
      >
        <input type="hidden" name="ticketId" value={ticket.id} />
        <label
          className="sr-only"
          htmlFor={`support-reply-${ticket.ticketNumber}`}
        >
          Reply
        </label>
        <textarea
          id={`support-reply-${ticket.ticketNumber}`}
          name="body"
          required
          maxLength={4000}
          rows={3}
          placeholder="Write a reply to the requester..."
          className="max-h-32 min-h-24 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-3.5 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-400/40"
        />
        <div className="mt-3 flex items-center justify-end">
          <SendReplyButton />
        </div>
      </form>
    </section>
  );
}
