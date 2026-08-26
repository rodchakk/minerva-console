"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Topbar } from "@/components/layout/Topbar";

type ShellProps = {
  children: React.ReactNode;
  email: string | null;
  previewReadOnly?: boolean;
};

export function Shell({ children, email, previewReadOnly = false }: ShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--console-bg)] text-[var(--console-text)]">
      <Topbar email={email} onOpenSidebar={() => setIsSidebarOpen(true)} />
      <AppSidebar
        email={email}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="lg:pl-64">
        {previewReadOnly ? (
          <div className="sticky top-0 z-30 border-y border-amber-300/60 bg-amber-300 px-4 py-2 text-center text-xs font-black uppercase tracking-[0.24em] text-slate-950 shadow-[0_8px_24px_rgba(245,158,11,0.24)] lg:px-6">
            PREVIEW · READ ONLY
          </div>
        ) : null}
        <main className="px-4 py-4 lg:px-6 lg:py-5 2xl:px-7">
          <div className="mx-auto max-w-[1820px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
