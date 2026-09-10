"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, LoaderCircle } from "lucide-react";
import type { EntryPushSurface } from "@/features/entry/push/server";

type PushState =
  | "checking"
  | "disabled"
  | "enabled"
  | "unsupported"
  | "denied"
  | "unavailable"
  | "busy";

type EntryPushControlProps = {
  surface: EntryPushSurface;
};

function supported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function saveSubscription(subscription: PushSubscription, surface: EntryPushSurface) {
  const response = await fetch("/api/entry/push/subscriptions", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON(), surface }),
  });

  if (!response.ok) throw new Error("subscription-save-failed");
}

async function deactivateSubscription(endpoint: string) {
  const response = await fetch("/api/entry/push/subscriptions", {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });

  if (!response.ok) throw new Error("subscription-deactivate-failed");
}

async function getRootRegistration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  return navigator.serviceWorker.register("/minerva-entry-push-sw.js", { scope: "/" });
}

export function EntryPushControl({ surface }: EntryPushControlProps) {
  const [state, setState] = useState<PushState>("checking");
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supported()) {
      setState("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();

      if (!subscription) {
        setState("disabled");
        return;
      }

      // Re-bind an already opted-in browser endpoint to the CURRENT authenticated
      // operator. The database RPC serializes ownership so one endpoint cannot
      // remain active for two Minerva accounts after an account switch.
      await saveSubscription(subscription, surface);
      setState("enabled");
    } catch {
      setState("unavailable");
      setMessage("Alerts could not be synchronized right now.");
    }
  }, [surface]);

  useEffect(() => {
    // Defer the external-system synchronization to a timer callback so the
    // effect body itself never synchronously cascades React state updates.
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refresh]);

  const enable = async () => {
    if (!supported()) {
      setState("unsupported");
      return;
    }

    setState("busy");
    setMessage(null);

    try {
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();

      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "disabled");
        return;
      }

      const keyResponse = await fetch("/api/entry/push/public-key", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!keyResponse.ok) throw new Error("public-key-unavailable");

      const keyJson = (await keyResponse.json()) as { publicKey?: unknown };
      if (typeof keyJson.publicKey !== "string" || !keyJson.publicKey) {
        throw new Error("public-key-invalid");
      }

      const registration = await getRootRegistration();
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyJson.publicKey),
        });
      }

      await saveSubscription(subscription, surface);
      setState("enabled");
      setMessage("ENTRY alerts are enabled on this device.");
    } catch {
      setState("unavailable");
      setMessage("Alerts could not be enabled. Try again from this device.");
    }
  };

  const disable = async () => {
    if (!supported()) {
      setState("unsupported");
      return;
    }

    setState("busy");
    setMessage(null);

    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();

      if (!subscription) {
        setState("disabled");
        return;
      }

      const [serverResult, browserResult] = await Promise.allSettled([
        deactivateSubscription(subscription.endpoint),
        subscription.unsubscribe(),
      ]);

      if (serverResult.status === "rejected" && browserResult.status === "rejected") {
        throw new Error("disable-failed");
      }

      setState("disabled");
      setMessage("ENTRY alerts are disabled on this device.");
    } catch {
      setState("enabled");
      setMessage("Alerts could not be disabled. Please try again.");
    }
  };

  if (state === "unsupported") {
    return (
      <p className="text-xs text-[var(--console-text-muted)]">
        Push alerts are not available in this browser. On iPhone or iPad, install Minerva Field to the Home Screen first.
      </p>
    );
  }

  if (state === "denied") {
    return (
      <p className="text-xs text-amber-200">
        Notifications are blocked for this site. Allow them in your browser settings to enable ENTRY alerts.
      </p>
    );
  }

  const field = surface === "field";
  const enabled = state === "enabled";
  const busy = state === "busy" || state === "checking";
  const Icon = busy ? LoaderCircle : enabled ? BellOff : Bell;

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={() => void (enabled ? disable() : enable())}
        className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-bold transition disabled:cursor-wait disabled:opacity-60 ${
          field
            ? "border-[var(--console-accent-border)] bg-[var(--console-accent-subtle)] text-[var(--console-text)] hover:bg-[var(--console-surface-hover)]"
            : "border-violet-400/25 bg-violet-500/10 text-violet-100 hover:bg-violet-500/15"
        }`}
      >
        <Icon aria-hidden="true" className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
        {busy ? "Checking alerts" : enabled ? "Disable alerts" : "Enable alerts"}
      </button>
      {state === "unavailable" || message ? (
        <p className="max-w-xs text-[11px] leading-4 text-[var(--console-text-muted)]">{message}</p>
      ) : null}
    </div>
  );
}
