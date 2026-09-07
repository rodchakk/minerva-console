import type { Metadata } from "next";
import Image from "next/image";
import { OutriderPublicForm } from "@/features/entry/outrider/public/OutriderPublicForm";
import { resolvePublicOutrider } from "@/features/entry/outrider/public/gateway";
import { hashOutriderToken } from "@/features/entry/outrider/token";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "ENTRY Outrider",
};

function UnavailableOutrider() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 text-slate-950">
      <div className="max-w-md rounded-lg border border-slate-200 bg-white px-5 py-6 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">
          ENTRY
        </p>
        <h1 className="mt-3 text-2xl font-semibold">
          Este enlace no está disponible
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Solicite a Minerva un nuevo enlace de preparación para su comunidad.
        </p>
      </div>
    </main>
  );
}

function OutriderBrandFooter() {
  return (
    <div className="bg-slate-50 px-4 pb-8 sm:px-6 sm:pb-10">
      <footer className="mx-auto w-full max-w-3xl border-t border-slate-200/80 pt-5">
        <div className="flex flex-col items-center gap-2">
          <Image
            alt="Minerva Technologies"
            className="h-auto w-40 opacity-75 sm:w-44"
            height={714}
            src="/brand/minerva-logo-gray.png"
            width={2129}
          />
          <p className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="M7 10V8a5 5 0 0 1 10 0v2m-9 0h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
            Tus datos están protegidos
          </p>
        </div>
      </footer>
    </div>
  );
}

export default async function PublicOutriderPage(
  props: { params: Promise<{ token: string }> },
) {
  const params = await props.params;
  const token = params.token.trim();
  const session = await resolvePublicOutrider({
    tokenHash: hashOutriderToken(token),
  });

  if (!session.available) {
    return <UnavailableOutrider />;
  }

  return (
    <>
      <OutriderPublicForm session={session} token={token} />
      <OutriderBrandFooter />
    </>
  );
}

export const viewport = {
  initialScale: 1,
  width: "device-width",
};
