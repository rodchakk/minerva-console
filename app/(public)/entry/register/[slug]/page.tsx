import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getCampaignAccessCookieName,
  normalizePublicSlug,
  readCampaignAccessCookieValue,
} from "@/features/entry/communityRegistration/public/accessState";
import { resolveCommunityRegistrationCampaign } from "@/features/entry/communityRegistration/public/gateway";
import {
  enforceCampaignPageReadRateLimit,
  isRateLimitDenied,
  rateLimitMessage,
} from "@/features/entry/communityRegistration/public/rateLimit";
import {
  EntryBadge,
  PublicRegistrationShell,
  RegistrationStepper,
} from "@/features/entry/communityRegistration/public/PublicRegistrationShell";
import { UnitLookupForm } from "@/features/entry/communityRegistration/public/UnitLookupForm";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Registro de residentes | ENTRY",
  robots: {
    follow: false,
    index: false,
  },
};

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function UnavailableState() {
  return (
    <PublicRegistrationShell>
      <RegistrationStepper currentStep={1} />
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm">
        <p className="text-base font-semibold text-amber-950">
          Enlace no disponible
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          No pudimos validar este enlace de registro. Verifica el enlace oficial
          o comunícate con la administración de tu comunidad.
        </p>
      </div>
    </PublicRegistrationShell>
  );
}

function TemporarilyUnavailableState({ message }: { message: string }) {
  return (
    <PublicRegistrationShell>
      <RegistrationStepper currentStep={1} />
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm">
        <p className="text-base font-semibold text-amber-950">
          Registro temporalmente no disponible
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-900">{message}</p>
      </div>
    </PublicRegistrationShell>
  );
}

export default async function EntryRegisterPage(
  props: PageProps<"/entry/register/[slug]">,
) {
  const [{ slug: rawSlug }, searchParams, cookieStore] = await Promise.all([
    props.params,
    props.searchParams,
    cookies(),
  ]);
  const slug = normalizePublicSlug(rawSlug);
  const token = getSingleParam(searchParams.token).trim();

  if (slug && token) {
    redirect(`/entry/register/${encodeURIComponent(slug)}/access?token=${encodeURIComponent(token)}`);
  }

  if (!slug) {
    return <UnavailableState />;
  }

  const cookieName = getCampaignAccessCookieName(slug);
  const accessState = readCampaignAccessCookieValue({
    cookieValue: cookieStore.get(cookieName)?.value,
    slug,
  });

  if (!accessState) {
    return <UnavailableState />;
  }

  const rateLimitDecision = await enforceCampaignPageReadRateLimit({
    rateLimitSessionId: accessState.rateLimitSessionId,
    slug,
    tokenHash: accessState.tokenHash,
  });

  if (isRateLimitDenied(rateLimitDecision)) {
    return <TemporarilyUnavailableState message={rateLimitMessage(rateLimitDecision)} />;
  }

  const campaign = await resolveCommunityRegistrationCampaign({
    publicSlug: slug,
    tokenHash: accessState.tokenHash,
  });

  if (!campaign.available) {
    return <UnavailableState />;
  }

  return (
    <PublicRegistrationShell>
      <UnitLookupForm
        intro={
          <div className="space-y-4">
            <EntryBadge />
            <p className="text-xl font-semibold text-slate-500">
              {campaign.communityName}
            </p>
            <h1 className="text-4xl font-bold text-slate-950 sm:text-5xl">
              Registro de residentes
            </h1>
            <p className="text-base leading-7 text-slate-600">
              {campaign.publicInstructions
                ? campaign.publicInstructions
                : "Completa la información de las personas que viven en tu vivienda. Primero identifica tu vivienda y luego revisa el registro antes de enviarlo."}
            </p>
          </div>
        }
        slug={slug}
        unitLabelPrefix={campaign.unitLabelPrefix}
      />
    </PublicRegistrationShell>
  );
}
