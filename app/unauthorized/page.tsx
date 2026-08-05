import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { signOutAction } from "@/features/auth/actions";
import { getAuthContext } from "@/features/auth/requireSuperadmin";

type UnauthorizedPageProps = {
  searchParams?: Promise<{ reason?: string }>;
};

export default async function UnauthorizedPage({
  searchParams,
}: UnauthorizedPageProps) {
  const [context, params] = await Promise.all([getAuthContext(), searchParams]);
  const isSignOutError = params?.reason === "sign_out_error";

  if (context.status === "unauthenticated") {
    redirect("/login");
  }

  if (context.status === "authorized" && !isSignOutError) {
    redirect("/dashboard");
  }

  const isAuthorizationError =
    context.status === "authorization_error" ||
    params?.reason === "authorization_error";
  const title = isSignOutError
    ? "We could not sign you out."
    : isAuthorizationError
      ? "We could not verify your access right now."
      : "You are signed in, but not authorized for Minerva Console.";
  const message = isSignOutError
    ? "Please try signing out again. If the issue persists, close this browser session and contact your Minerva administrator."
    : isAuthorizationError
      ? "Sign out and try again. If the issue persists, contact your Minerva administrator."
      : "This workspace is limited to approved superadmin accounts. If you believe you should have access, contact your Minerva administrator to review your account permissions.";

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl rounded-[36px] border border-[var(--border)] bg-white p-10 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-600">
          {isAuthorizationError || isSignOutError
            ? "Authorization check error"
            : "Access restricted"}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          {message}
        </p>
        {isSignOutError ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            We could not sign you out. Please try again.
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <form action={signOutAction}>
            <Button type="submit" variant="primary">
              Sign out & return to login
            </Button>
          </form>
          {isAuthorizationError ? (
            <Link href="/dashboard">
              <Button variant="secondary">Try again</Button>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
