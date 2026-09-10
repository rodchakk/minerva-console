"use client";

import { useState } from "react";
import { BellRing, LoaderCircle } from "lucide-react";

const FIELD_NOTIFICATION_ICON = "/icons/minerva-field-192.png";
const FIELD_NOTIFICATION_BADGE = "/icons/minerva-field-notification-badge.png";

type DiagnosticState = "idle" | "running" | "success" | "error";

export function EntryPushLocalDiagnostic() {
  const [state, setState] = useState<DiagnosticState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const run = async () => {
    setState("running");
    setMessage(null);

    try {
      if (!("serviceWorker" in navigator) || !("Notification" in window)) {
        throw new Error("This device does not expose Web Push notification APIs.");
      }

      if (Notification.permission !== "granted") {
        throw new Error(`Notification permission is ${Notification.permission}.`);
      }

      const registration = await navigator.serviceWorker.getRegistration("/");
      if (!registration) {
        throw new Error("No root service worker registration is active on this device.");
      }

      try {
        await registration.update();
      } catch {
        // A network/update failure does not prevent testing the currently active worker.
      }

      await registration.showNotification("Minerva Field test", {
        body: "Local notification test from this device.",
        tag: `minerva-field-local-test-${Date.now()}`,
        icon: FIELD_NOTIFICATION_ICON,
        badge: FIELD_NOTIFICATION_BADGE,
      });

      setState("success");
      setMessage("Local notification requested. Confirm whether Android displayed it.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Local notification test failed.");
    }
  };

  const running = state === "running";
  const Icon = running ? LoaderCircle : BellRing;

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        disabled={running}
        onClick={() => void run()}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/[0.03] px-3 text-xs font-bold text-[var(--console-text-muted)] transition hover:border-[var(--console-accent-border)] hover:text-[var(--console-text)] disabled:cursor-wait disabled:opacity-60"
      >
        <Icon aria-hidden="true" className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
        {running ? "Testing alert" : "Test alert"}
      </button>
      {message ? (
        <p
          className={`max-w-xs text-[11px] leading-4 ${
            state === "error" ? "text-amber-200" : "text-[var(--console-text-muted)]"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
