import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description: string;
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-200">
            Minerva Console
          </p>
          <span className="inline-flex items-center rounded-full bg-violet-500/14 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-200 ring-1 ring-inset ring-violet-400/20">
            ENTRY
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          {title}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{description}</p>
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
}
