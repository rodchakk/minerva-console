import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizePublicSlug } from "@/features/entry/communityRegistration/public/accessState";
import {
  getCorrectionAccessCookieName,
  readCorrectionAccessCookieValue,
} from "@/features/entry/communityRegistration/public/correctionAccessState";
import { resolveCommunityRegistrationEdit } from "@/features/entry/communityRegistration/public/gateway";
import {
  enforceCorrectionPageReadRateLimit,
  isRateLimitDenied,
  rateLimitMessage,
} from "@/features/entry/communityRegistration/public/rateLimit";
import { HouseholdDraftForm } from "@/features/entry/communityRegistration/public/HouseholdDraftForm";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Correccion de registro | ENTRY",
  robots: {
    follow: false,
    index: false,
  },
};

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function PublicCorrectionFrame({
  children,
  communityName,
  title = "Correccion de registro",
}: {
  children: React.ReactNode;
  communityName?: string;
  title?: string;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(109,99,255,0.16),transparent_30%),linear-gradient(180deg,#080b12_0%,#07090d_100%)] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl items-center">
        <section className="w-full rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(16,20,29,0.96),rgba(10,14,21,0.98))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.34)] sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-200">
            ENTRY
          </p>
          {communityName ? (
            <p className="mt-4 text-sm font-semibold text-[var(--text-soft)]">
              {communityName}
            </p>
          ) : null}
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {title}
          </h1>
          {children}
        </section>
      </div>
    </main>
  );
}

function UnavailableCorrectionState() {
  return (
    <PublicCorrectionFrame>
      <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-4">
        <p className="text-base font-semibold text-amber-100">
          Enlace de correccion no disponible
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-50/80">
          No pudimos validar este enlace de correccion. Verifica el enlace
          oficial o comunicate con la administracion de tu comunidad.
        </p>
      </div>
    </PublicCorrectionFrame>
  );
}

function TemporarilyUnavailableCorrectionState({ message }: { message: string }) {
  return (
    <PublicCorrectionFrame>
      <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-4">
        <p className="text-base font-semibold text-amber-100">
          Correccion temporalmente no disponible
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-50/80">{message}</p>
      </div>
    </PublicCorrectionFrame>
  );
}

type EntryCorrectionPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EntryCorrectionPage(
  props: EntryCorrectionPageProps,
) {
  const [{ slug: rawSlug }, searchParams, cookieStore] = await Promise.all([
    props.params,
    props.searchParams,
    cookies(),
  ]);
  const slug = normalizePublicSlug(rawSlug);
  const token = getSingleParam(searchParams.token).trim();

  if (slug && token) {
    redirect(
      `/entry/register/${encodeURIComponent(slug)}/correct/access?token=${encodeURIComponent(token)}`,
    );
  }

  if (!slug) {
    return <UnavailableCorrectionState />;
  }

  const correctionState = readCorrectionAccessCookieValue({
    cookieValue: cookieStore.get(getCorrectionAccessCookieName(slug))?.value,
    slug,
  });

  if (!correctionState) {
    return <UnavailableCorrectionState />;
  }

  const rateLimitDecision = await enforceCorrectionPageReadRateLimit({
    editTokenHash: correctionState.editTokenHash,
    slug,
  });

  if (isRateLimitDenied(rateLimitDecision)) {
    return (
      <TemporarilyUnavailableCorrectionState
        message={rateLimitMessage(rateLimitDecision)}
      />
    );
  }

  const correction = await resolveCommunityRegistrationEdit({
    editTokenHash: correctionState.editTokenHash,
  });

  if (
    !correction.available ||
    normalizePublicSlug(correction.publicSlug) !== slug
  ) {
    return <UnavailableCorrectionState />;
  }

  return (
    <PublicCorrectionFrame title={correction.publicTitle}>
      <div className="mt-6 space-y-4">
        {correction.publicInstructions ? (
          <p className="text-sm leading-6 text-[var(--text-muted)]">
            {correction.publicInstructions}
          </p>
        ) : (
          <p className="text-sm leading-6 text-[var(--text-muted)]">
            Actualiza la informacion de tu vivienda. Revisa los cambios antes
            de enviarlos a la administracion.
          </p>
        )}

        {correction.correctionObservation ? (
          <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
              Observacion de la administracion
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-50/90">
              {correction.correctionObservation}
            </p>
          </div>
        ) : null}

        <HouseholdDraftForm
          finalAction="correction-submit"
          initialResidents={correction.residents.map((resident) => ({
            email: resident.email,
            fullName: resident.fullName,
            isOwnerReference: resident.isOwnerReference,
            phone: resident.phone,
            relationshipToHouse: resident.relationshipToHouse,
          }))}
          introText="Actualiza la informacion de las personas registradas para esta vivienda. El envio solo ocurre despues de revisar los cambios."
          residentLimit={correction.effectiveResidentLimit}
          slug={slug}
          unitLabel={correction.unitLabel}
        />
      </div>
    </PublicCorrectionFrame>
  );
}
