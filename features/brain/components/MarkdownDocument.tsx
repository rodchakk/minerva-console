"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownDocumentProps = {
  body: string;
  sourcePath: string;
};

export function MarkdownDocument({ body, sourcePath }: MarkdownDocumentProps) {
  return (
    <div className="space-y-4">
      <div className="prose prose-invert max-w-none rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur prose-headings:text-white prose-p:text-slate-300 prose-a:text-sky-400 prose-strong:text-white prose-code:rounded prose-code:bg-white/8 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sky-300 prose-pre:rounded-xl prose-pre:border prose-pre:border-[var(--border)] prose-pre:bg-[var(--bg)] prose-li:text-slate-300 prose-th:text-slate-200 prose-td:text-slate-300 prose-hr:border-[var(--border)] prose-blockquote:border-sky-400/30 prose-blockquote:text-slate-400">
        <Markdown remarkPlugins={[remarkGfm]}>{body}</Markdown>
      </div>
      <p className="text-[11px] text-[var(--text-muted)]">
        Source: <code className="rounded bg-white/5 px-1.5 py-0.5">{sourcePath}</code>
      </p>
    </div>
  );
}
