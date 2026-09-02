"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { updateConsolePasswordAction } from "@/features/auth/actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-10 rounded-md bg-[#ff2d2d] px-4 hover:bg-[#d90f17]"
    >
      {pending ? "Saving..." : "Set password"}
    </Button>
  );
}

export function ConsolePasswordSetupForm() {
  const [state, formAction] = useActionState(updateConsolePasswordAction, {});

  return (
    <form action={formAction} className="mt-5 space-y-3">
      <label className="grid gap-1.5 text-sm text-slate-300">
        Password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="h-10 rounded-md border border-white/[0.12] bg-white/[0.025] px-3 text-white outline-none transition focus:border-[#ff4d4d]/50"
        />
      </label>
      {state.message ? (
        <p className="rounded-md border border-rose-500/25 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
          {state.message}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
