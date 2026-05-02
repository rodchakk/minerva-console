import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/LoginForm";
import { getAuthContext } from "@/features/auth/requireSuperadmin";

export default async function LoginPage() {
  const { user, isSuperadmin } = await getAuthContext();

  if (user) {
    redirect(isSuperadmin ? "/dashboard" : "/unauthorized");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[36px] border border-white/60 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)] lg:grid-cols-[1.15fr_0.85fr]">
        <section className="bg-[linear-gradient(135deg,#0f172a_0%,#134e4a_100%)] p-8 text-white lg:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-teal-200">
            Minerva Technologies
          </p>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight">
            Minerva Console
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-7 text-slate-200">
            Global internal control center for product operations, client oversight,
            and future business modules across Minerva.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-sm text-teal-200">Access model</p>
              <p className="mt-2 text-lg font-semibold">Supabase Auth + RPC authorization</p>
            </div>
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-sm text-teal-200">Route security</p>
              <p className="mt-2 text-lg font-semibold">Protected internal console shell</p>
            </div>
          </div>
        </section>

        <section className="p-8 lg:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
            Superadmin sign in
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
            Welcome back
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Sign in with your Minerva credentials. Access is granted only when the
            backend <code>is_superadmin()</code> RPC returns true.
          </p>
          <div className="mt-8">
            <LoginForm />
          </div>
        </section>
      </div>
    </div>
  );
}
