"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/Button";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      className="w-full !rounded-[14px] !bg-[linear-gradient(180deg,#ff2d2d_0%,#d90f17_100%)] !py-3.5 text-base !text-white shadow-[0_18px_38px_rgba(220,38,38,0.22)] transition hover:!bg-[linear-gradient(180deg,#ff4040_0%,#c20f16_100%)] disabled:!bg-slate-600"
      type="submit"
      disabled={pending}
    >
      {pending ? "Signing in..." : "Sign in"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-white/88" htmlFor="email">
          Email
        </label>
        <div className="flex items-center gap-3 rounded-[14px] border border-white/12 bg-[rgba(255,255,255,0.02)] px-4 py-2.5 text-white/42 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition focus-within:border-[#ff3b3b] focus-within:text-[#ff3b3b] focus-within:ring-4 focus-within:ring-[#ff3b3b]/10">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M4 19c0-2.8 3.1-4.5 8-4.5s8 1.7 8 4.5" />
            <circle cx="12" cy="8" r="3.25" />
          </svg>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            className="w-full bg-transparent text-white outline-none placeholder:text-white/30"
            placeholder="Enter your email"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-white/88" htmlFor="password">
          Password
        </label>
        <div className="flex items-center gap-3 rounded-[14px] border border-white/12 bg-[rgba(255,255,255,0.02)] px-4 py-2.5 text-white/42 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition focus-within:border-[#ff3b3b] focus-within:text-[#ff3b3b] focus-within:ring-4 focus-within:ring-[#ff3b3b]/10">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7.75a4 4 0 1 1 8 0V10" />
          </svg>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="w-full bg-transparent text-white outline-none placeholder:text-white/30"
            placeholder="Enter your password"
            required
          />
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0 text-white/30"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
            <circle cx="12" cy="12" r="2.5" />
          </svg>
        </div>
      </div>

      {state.message ? (
        <p className="rounded-[14px] border border-rose-500/25 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
          {state.message}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
