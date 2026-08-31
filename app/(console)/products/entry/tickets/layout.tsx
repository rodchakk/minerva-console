import type { ReactNode } from "react";
import { RealtimeTicketsRefresh } from "@/features/entry/support/RealtimeTicketsRefresh";

export default function EntryTicketsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <RealtimeTicketsRefresh />
      {children}
    </>
  );
}
