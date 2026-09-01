"use client";

import { useEffect, useMemo, useRef } from "react";
import { Send } from "lucide-react";
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
      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-violet-400/20 bg-violet-500/14 px-4 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
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
          "max-w-[92%] rounded-lg border px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.16)] sm:max-w-[78%]",
          staff
            ? "border-violet-400/20 bg-violet-500/12"
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
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white">
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
  const latestMessageKey = useMemo(() => {
    const latest = messages[messages.length - 1];
    return latest ? `${latest.id}:${latest.createdAt}` : ticket.createdAt;
  }, [messages, ticket.createdAt]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    node.scrollTo({
      behavior: "smooth",
      top: node.scrollHeight,
    });
  }, [latestMessageKey]);

  return (
    <section className="flex h-[min(72vh,760px)] min-h-[540px] flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(2,6,23,0.22)]">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase text-violet-200">
            Conversation
          </p>
          <h2 className="mt-1 truncate text-base font-semibold text-white">
            Ticket activity
          </h2>
        </div>
        <p className="shrink-0 rounded-md border border-[var(--border)] bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)]">
          {messages.length + 1} messages
        </p>
      </div>

      {loadError ? (
        <div className="mx-4 mt-4 rounded-md border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 sm:mx-5">
          Some messages could not be loaded.
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5"
      >
        <div className="space-y-4">
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
          className="max-h-36 min-h-24 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-3.5 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-400/40"
        />
        <div className="mt-3 flex items-center justify-end">
          <SendReplyButton />
        </div>
      </form>
    </section>
  );
}
