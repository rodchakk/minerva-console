import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  /**
   * Optional eyebrow above the title. When omitted, the default
   * "Minerva Console · ENTRY" eyebrow renders (preserves prior behavior).
   * Pages outside ENTRY (e.g. Brain) should pass their own eyebrow.
   */
  eyebrow?: ReactNode;
};

const defaultEyebrow = (
  <div className="flex flex-wrap items-center gap-2">
    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
      Minerva Console
    </p>
    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
      ·
    </span>
    <span className="inline-flex items-center rounded-md border border-violet-400/16 bg-violet-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200">
      ENTRY
    </span>
  </div>
);

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        {eyebrow ?? defaultEyebrow}
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          {title}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{description}</p>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
