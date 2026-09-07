import type { Metadata } from "next";
import { isOutriderEditable } from "@/features/entry/outrider/model";
import { OutriderOptionalFilesAcknowledge } from "@/features/entry/outrider/public/OutriderOptionalFilesAcknowledge";
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

  const canAcknowledgeNoFiles =
    isOutriderEditable(session.status) &&
    !session.completedSections.includes("available_information");

  return (
    <>
      {canAcknowledgeNoFiles ? (
        <OutriderOptionalFilesAcknowledge token={token} />
      ) : null}
      <OutriderPublicForm session={session} token={token} />
    </>
  );
}

export const viewport = {
  initialScale: 1,
  width: "device-width",
};
