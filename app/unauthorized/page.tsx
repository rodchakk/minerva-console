import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl rounded-[36px] border border-[var(--border)] bg-white p-10 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-600">
          Access restricted
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          You are signed in, but not authorized for Minerva Console.
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          This workspace is limited to approved superadmin accounts. If you
          believe you should have access, contact your Minerva administrator to
          review your account permissions.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/login">
            <Button variant="secondary">Back to login</Button>
          </Link>
          <Link href="/">
            <Button>Try again</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
