"use client";

import type { ReactNode } from "react";

// Presentation-only tabs shared by ENTRY drawers. Their parent owns the
// selected tab and keeps the drawer frame/footer mounted at all times.
export type DrawerTab<T extends string> = {
  id: T;
  label: string;
};

export function EntryDrawerTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: readonly DrawerTab<T>[];
  value: T;
  onChange: (tab: T) => void;
  label: string;
}) {
  return (
    <div className="grid shrink-0 border-b border-[#141119] bg-[#292431] px-3"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button key={tab.id} type="button" role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={`relative min-h-12 px-1.5 py-3 text-[13px] font-semibold leading-4 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#A28AFF] ${
            value === tab.id ? "text-white" : "text-[#A9A3B2] hover:text-white"
          }`}>
          {tab.label}
          {value === tab.id && (
            <span aria-hidden className="absolute inset-x-2 bottom-0 h-[3px] rounded-t bg-[#7553FF]" />
          )}
        </button>
      ))}
    </div>
  );
}

export function EntryDrawerSection({
  title, children, description,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-white/[0.09] bg-white/[0.012]">
      <div className="border-b border-white/[0.07] px-3.5 py-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {description && <p className="mt-1 text-xs leading-5 text-[#A9A3B2]">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function EntryDrawerField({
  label, children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(104px,38%)_minmax(0,1fr)] items-start gap-3 border-b border-white/[0.06] px-3.5 py-3 last:border-b-0">
      <span className="text-[13px] leading-5 text-[#B7AEBD]">{label}</span>
      <div className="min-w-0 break-words text-right text-[13px] font-medium leading-5 text-white">{children}</div>
    </div>
  );
}
