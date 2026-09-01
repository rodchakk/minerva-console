import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/LoginForm";
import {
  getSafePostLoginDestination,
} from "@/features/auth/postLoginDestination";
import { getAuthContext } from "@/features/auth/requireSuperadmin";

type LoginPageProps = {
  searchParams?: Promise<{ next?: string | string[] }>;
};

function getSingleParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [context, params] = await Promise.all([getAuthContext(), searchParams]);
  const postLoginDestination = getSafePostLoginDestination(getSingleParam(params?.next));

  if (context.status === "authorized") {
    redirect(postLoginDestination);
  }

  if (context.status === "forbidden") {
    redirect("/unauthorized");
  }

  if (context.status === "authorization_error") {
    redirect("/unauthorized?reason=authorization_error");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_38%,rgba(185,28,28,0.12),transparent_28%),radial-gradient(circle_at_76%_68%,rgba(127,29,29,0.08),transparent_30%)]" />

      <section className="relative grid w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-[0_28px_100px_rgba(0,0,0,0.58)] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative flex min-h-[300px] flex-col justify-center border-b border-white/8 p-7 sm:p-10 lg:min-h-[520px] lg:border-b-0 lg:border-r">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_35%_45%,rgba(127,29,29,0.12),transparent_45%)]" />
          <div className="relative">
            <div className="flex max-w-[28rem] justify-start">
              <Image
                src="/minerva-logo-transparent.png"
                alt="Minerva Technologies"
                width={520}
                height={220}
                priority
                className="h-auto w-[300px] sm:w-[360px]"
              />
            </div>
          </div>
        </div>

        <div className="relative flex items-center p-7 sm:p-10">
          <div className="mx-auto w-full max-w-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-red-400">
              MINERVA CONSOLE
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white">
              Welcome back
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/48">
              Sign in to continue.
            </p>

            <div className="mt-7">
              <LoginForm next={postLoginDestination} />
            </div>

            <p className="mt-7 text-xs text-white/28">
              Minerva Technologies
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
