import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/LoginForm";
import { getAuthContext } from "@/features/auth/requireSuperadmin";

const infoCards = [
  { label: "Access", text: "Authorized only" },
  { label: "Environment", text: "Internal system" },
  { label: "Status", text: "Production" },
];

export default async function LoginPage() {
  const { user, isSuperadmin } = await getAuthContext();

  if (user) {
    redirect(isSuperadmin ? "/dashboard" : "/unauthorized");
  }

  return (
    <div className="flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.28),transparent_20%),radial-gradient(circle_at_bottom,rgba(127,29,29,0.2),transparent_24%),linear-gradient(180deg,#050505_0%,#070707_52%,#030303_100%)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(220,38,38,0.18),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-[radial-gradient(circle_at_bottom,rgba(220,38,38,0.18),transparent_60%)]" />

      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-[30px] border border-[rgba(255,255,255,0.12)] bg-[linear-gradient(180deg,rgba(10,10,10,0.97),rgba(7,7,7,0.98))] shadow-[0_36px_140px_rgba(0,0,0,0.62)] backdrop-blur lg:grid-cols-[1.12fr_0.88fr]">
        <section className="relative overflow-hidden border-b border-white/10 p-7 text-white sm:p-9 lg:border-b-0 lg:border-r lg:border-r-[rgba(220,38,38,0.55)] lg:p-10">
          <div className="absolute inset-y-0 right-0 hidden w-px bg-[linear-gradient(180deg,transparent,rgba(220,38,38,0.9),transparent)] lg:block" />
          <div className="absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(127,29,29,0.18),transparent_68%)] blur-3xl" />
          <div className="absolute bottom-[-16%] left-[12%] h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(220,38,38,0.16),transparent_70%)] blur-3xl" />

          <div className="relative flex h-full flex-col justify-center">
            <div className="mx-auto flex w-full max-w-[32rem] justify-center">
              <Image
                src="/minerva-logo-transparent.png"
                alt="Minerva Technologies"
                width={520}
                height={220}
                priority
                className="h-auto w-[380px] sm:w-[470px] lg:w-[500px]"
              />
            </div>

            <div className="mx-auto w-full max-w-[32rem]">
              <h1 className="mt-4 text-center text-[2.8rem] font-semibold tracking-[-0.05em] text-white sm:text-5xl lg:text-[3.6rem]">
                Minerva Console
              </h1>
              <p className="mt-4 max-w-xl text-center text-base leading-7 text-white/64 sm:text-[1.05rem]">
                Secure internal access for authorized personnel.
              </p>
            </div>

            <div className="relative mx-auto mt-10 grid w-full max-w-[30rem] gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {infoCards.map((card, index) => (
                <div
                  key={card.label}
                  className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 text-center shadow-[0_16px_44px_rgba(0,0,0,0.22)] backdrop-blur sm:min-h-[154px]"
                >
                  <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-[#ff2b2b]/60 text-[#ff2b2b] shadow-[0_0_22px_rgba(220,38,38,0.12)]">
                    <span className="text-sm font-semibold">{index + 1}</span>
                  </div>
                  <p className="text-sm text-white/54">{card.label}</p>
                  <p className="mt-2 text-[1.1rem] font-medium text-white">
                    {card.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative flex items-center bg-[linear-gradient(180deg,rgba(14,14,14,0.98),rgba(10,10,10,0.99))] p-7 sm:p-9 lg:p-10">
          <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(220,38,38,0.58),transparent)] lg:hidden" />
          <div className="absolute inset-x-[18%] bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(220,38,38,0.4),transparent)]" />
          <div className="mx-auto flex h-full w-full max-w-sm flex-col justify-center">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#ff3b3b]">
              MINERVA SECURE ACCESS
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-[2.2rem]">
              Welcome back
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/54 sm:text-[15px]">
              Sign in to continue.
            </p>
            <div className="mt-7">
              <LoginForm />
            </div>
            <div className="mt-7 flex items-center gap-4 text-white/28">
              <div className="h-px flex-1 bg-white/10" />
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
                </svg>
              </div>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            <p className="mt-4 text-center text-sm text-white/34">
              Minerva internal system
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
