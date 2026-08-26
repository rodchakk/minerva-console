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
import {
  EntryBadge,
  PublicRegistrationShell,
  RegistrationStepper,
} from "@/features/entry/communityRegistration/public/PublicRegistrationShell";
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

function UnavailableCorrectionState() {
  return (
    <PublicRegistrationShell>
      <RegistrationStepper currentStep={2} />
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm">
        <p className="text-base font-semibold text-amber-950">
          Enlace de corrección no disponible
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          No pudimos validar este enlace de corrección. Verifica el enlace
          oficial o comunícate con la administración de tu comunidad.
        </p>
      </div>
    </PublicRegistrationShell>
  );
}

function TemporarilyUnavailableCorrectionState({ message }: { message: string }) {
  return (
    <PublicRegistrationShell>
      <RegistrationStepper currentStep={2} />
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm">
        <p className="text-base font-semibold text-amber-950">
          Correccion temporalmente no disponible
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-900">{message}</p>
      </div>
    </PublicRegistrationShell>
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
    <PublicRegistrationShell>
      <div className="space-y-6">
        <div className="space-y-4">
          <EntryBadge />
          <p className="text-xl font-semibold text-slate-500">
            {correction.publicTitle}
          </p>
          <h1 className="text-4xl font-bold text-slate-950 sm:text-5xl">
            Correccion de residentes
          </h1>
          <p className="text-base leading-7 text-slate-600">
            {correction.publicInstructions
              ? correction.publicInstructions
              : "Actualiza la información de tu vivienda. Revisa los cambios antes de enviarlos a la administración."}
          </p>
        </div>

        {correction.correctionObservation ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-amber-900">
              Observación de la administración
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-900">
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
          introText="Actualiza la información de las personas registradas para esta vivienda. El envío solo ocurre después de revisar los cambios."
          residentLimit={correction.effectiveResidentLimit}
          slug={slug}
          unitLabel={correction.unitLabel}
        />
      </div>
    </PublicRegistrationShell>
  );
}
