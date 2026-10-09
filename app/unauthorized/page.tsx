import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { signOutAction } from "@/features/auth/actions";
import { getConsoleAccessContext } from "@/features/auth/consoleAccess";
import {
  DEFAULT_POST_LOGIN_DESTINATION,
  MEMBER_POST_LOGIN_DESTINATION,
} from "@/features/auth/postLoginDestination";

type UnauthorizedPageProps = {
  searchParams?: Promise<{ reason?: string }>;
};

export default async function UnauthorizedPage({
  searchParams,
}: UnauthorizedPageProps) {
  const [context, params] = await Promise.all([
    getConsoleAccessContext(),
    searchParams,
  ]);
  const isSignOutError = params?.reason === "sign_out_error";

  if (context.status === "unauthenticated") {
    redirect("/login");
  }

  if (context.status === "temporarily_unavailable") {
    redirect("/temporarily-unavailable");
  }

  const isOwner = context.status === "authorized" && context.role === "owner";
  const isMember = context.status === "authorized" && context.role !== "owner";

  // Never automatically bounce Owners back to the dashboard from a denied
  // module. Some legacy ENTRY routes still use a separate superadmin gate.
  // Redirecting an authenticated Console Owner straight back to the rejected
  // dashboard created an infinite /dashboard <-> /unauthorized loop.
  const isAuthorizationError =
    context.status === "authorization_error" ||
    params?.reason === "authorization_error";

  const title = isSignOutError
    ? "We could not sign you out."
    : isAuthorizationError
      ? "We could not verify your access right now."
      : isMember
        ? "This area requires Owner access."
        : isOwner
          ? "This module could not verify your access."
          : "You are signed in, but not authorized for Minerva Console.";

  const message = isSignOutError
    ? "Please try signing out again. If the issue persists, close this browser session and contact your Minerva administrator."
    : isAuthorizationError
      ? "Sign out and try again. If the issue persists, contact your Minerva administrator."
      : isMember
        ? "Your Minerva Console account is active, but this area is restricted to Owners."
        : isOwner
          ? "Your Console Owner account is active, but the requested module denied access. This can happen when an older module still requires separate administrator permissions. Contact your Minerva administrator if it persists."
          : "This workspace is limited to active Minerva Console members. If you believe you should have access, contact your Minerva administrator to review your account permissions.";

  const badgeText =
    isAuthorizationError || isSignOutError
      ? "Authorization check error"
      : "Access restricted";

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl rounded-[36px] border border-[var(--border)] bg-white p-10 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-600">
          {badgeText}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">{message}</p>
        {isSignOutError ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            We could not sign you out. Please try again.
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {isMember ? (
            <Link href={MEMBER_POST_LOGIN_DESTINATION}>
              <Button variant="primary">Return to workspace</Button>
            </Link>
          ) : null}
          {isOwner && !isSignOutError ? (
            <Link href={DEFAULT_POST_LOGIN_DESTINATION}>
              <Button variant="secondary">Try dashboard again</Button>
            </Link>
          ) : null}
          <form action={signOutAction}>
            <Button type="submit" variant={isMember ? "secondary" : "primary"}>
              Sign out{isMember ? "" : " & return to login"}
            </Button>
          </form>
          {isAuthorizationError ? (
            <Link href={DEFAULT_POST_LOGIN_DESTINATION}>
              <Button variant="secondary">Try again</Button>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
