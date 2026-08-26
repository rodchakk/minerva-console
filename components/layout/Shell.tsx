"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Topbar } from "@/components/layout/Topbar";

type ShellProps = {
  children: React.ReactNode;
  email: string | null;
};

export function Shell({ children, email }: ShellProps) {
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
        <main className="px-4 py-4 lg:px-6 lg:py-5 2xl:px-7">
          <div className="mx-auto max-w-[1820px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
