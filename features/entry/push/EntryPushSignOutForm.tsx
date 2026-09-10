"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { signOutAction } from "@/features/auth/actions";

type EntryPushSignOutFormProps = {
  field?: boolean;
};

async function getSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration?.pushManager.getSubscription() ?? null;
}

async function cleanupCurrentBrowserPush(subscription: PushSubscription) {
  const serverCleanup = fetch("/api/entry/push/subscriptions", {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
    keepalive: true,
  }).then((response) => {
    if (!response.ok) throw new Error("server-push-cleanup-failed");
  });

  await Promise.allSettled([serverCleanup, subscription.unsubscribe()]);
}

export function EntryPushSignOutForm({ field = false }: EntryPushSignOutFormProps) {
  const [endpoint, setEndpoint] = useState("");
  const submitAfterCleanup = useRef(false);

  useEffect(() => {
    let active = true;
    void getSubscription()
      .then((subscription) => {
        if (active) setEndpoint(subscription?.endpoint ?? "");
      })
      .catch(() => {
        if (active) setEndpoint("");
      });

    return () => {
      active = false;
    };
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    if (submitAfterCleanup.current) {
      submitAfterCleanup.current = false;
      return;
    }

    event.preventDefault();
    const form = event.currentTarget;

    try {
      const subscription = await getSubscription();
      if (subscription) {
        // Cleanup is bounded. A broken Push API or network must never prevent
        // the operator from signing out.
        await Promise.race([
          cleanupCurrentBrowserPush(subscription),
          new Promise<void>((resolve) => setTimeout(resolve, 650)),
        ]);
      }
    } catch {
      // Fail open to authentication sign-out. The server action has a second
      // best-effort cleanup using the hidden endpoint below.
    } finally {
      submitAfterCleanup.current = true;
      form.requestSubmit();
    }
  };

  return (
    <form action={signOutAction} onSubmit={onSubmit} className={field ? "w-full" : "shrink-0"}>
      <input type="hidden" name="entryPushEndpoint" value={endpoint} />
      <Button
        variant="secondary"
        type="submit"
        className={
          field
            ? "min-h-12 w-full gap-2 border-[var(--console-border-strong)] bg-[var(--console-surface)] text-[var(--console-text)] hover:border-[var(--console-accent-border)] hover:bg-[var(--console-surface-hover)]"
            : "min-w-24 gap-2"
        }
      >
        {field ? <LogOut aria-hidden="true" className="h-4 w-4" /> : null}
        Sign out
        {!field ? <LogOut aria-hidden="true" className="h-4 w-4 stroke-[1.75]" /> : null}
      </Button>
    </form>
  );
}
