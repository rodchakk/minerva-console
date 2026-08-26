import { CreateCommunityForm } from "@/features/entry/communities/CreateCommunityForm";
import { OnboardingGuideTrigger } from "@/features/entry/communities/OnboardingGuideTrigger";

export default function NewCommunityPage() {
  return (
    <div className="space-y-5">
      <section className="px-0.5 pt-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">
              MINERVA CONSOLE · ENTRY
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white lg:text-[2.05rem]">
              Create community
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
              Onboard a new ENTRY community in three steps: details, features, and units import.
            </p>
          </div>

          <OnboardingGuideTrigger />
        </div>
      </section>

      <CreateCommunityForm />
    </div>
  );
}
