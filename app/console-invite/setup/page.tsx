import { requireConsoleMember } from "@/features/auth/consoleAccess";
import { ConsolePasswordSetupForm } from "@/features/auth/ConsolePasswordSetupForm";

export default async function ConsoleInviteSetupPage() {
  await requireConsoleMember();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--console-bg)] px-4 py-10 text-[var(--console-text)]">
      <section className="w-full max-w-md rounded-lg border border-white/[0.10] bg-[#10151b] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ff6b6b]">
          Minerva Console
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Set your password</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
          Finish setting up your Console account. Your workspace will open after
          this password is saved.
        </p>
        <ConsolePasswordSetupForm />
      </section>
    </main>
  );
}
