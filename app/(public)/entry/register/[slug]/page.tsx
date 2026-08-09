import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getCampaignAccessCookieName,
  normalizePublicSlug,
  readCampaignAccessCookieValue,
} from "@/features/entry/communityRegistration/public/accessState";
import { resolveCommunityRegistrationCampaign } from "@/features/entry/communityRegistration/public/gateway";
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

function PublicRegistrationFrame({
  children,
  communityName,
}: {
  children: React.ReactNode;
  communityName?: string;
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
            Registro de residentes
          </h1>
          {children}
        </section>
      </div>
    </main>
  );
}

function UnavailableState() {
  return (
    <PublicRegistrationFrame>
      <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-4">
        <p className="text-base font-semibold text-amber-100">
          Enlace no disponible
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-50/80">
          No pudimos validar este enlace de registro. Verifica el enlace oficial
          o comunicate con la administracion de tu comunidad.
        </p>
      </div>
    </PublicRegistrationFrame>
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

  const campaign = await resolveCommunityRegistrationCampaign({
    publicSlug: slug,
    tokenHash: accessState.tokenHash,
  });

  if (!campaign.available) {
    return <UnavailableState />;
  }

  return (
    <PublicRegistrationFrame communityName={campaign.communityName}>
      <div className="mt-6 space-y-4">
        {campaign.publicInstructions ? (
          <p className="text-sm leading-6 text-[var(--text-muted)]">
            {campaign.publicInstructions}
          </p>
        ) : (
          <p className="text-sm leading-6 text-[var(--text-muted)]">
            Este registro esta listo para iniciar. En el siguiente paso podras
            identificar tu vivienda y registrar a los residentes del hogar.
          </p>
        )}

        <UnitLookupForm slug={slug} />
      </div>
    </PublicRegistrationFrame>
  );
}
