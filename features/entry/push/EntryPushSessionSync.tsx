"use client";

import { useEffect } from "react";
import type { EntryPushSurface } from "@/features/entry/push/server";

type EntryPushSessionSyncProps = {
  surface: EntryPushSurface;
};

export function EntryPushSessionSync({ surface }: EntryPushSessionSyncProps) {
  useEffect(() => {
    let active = true;

    void (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!active || !subscription) return;

      // No permission prompt occurs here. This only rebinds an already-existing
      // endpoint to the currently authenticated operator, preventing a stale
      // prior-session owner from surviving an account change in this browser.
      await fetch("/api/entry/push/subscriptions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON(), surface }),
      });
    })().catch(() => {
      // Fail silently. Dispatch-time authorization is the final safety gate.
    });

    return () => {
      active = false;
    };
  }, [surface]);

  return null;
}
