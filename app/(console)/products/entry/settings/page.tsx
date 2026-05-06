import { PageHeader } from "@/components/layout/PageHeader";

const settingsCards = [
  {
    title: "Feature toggles",
    description:
      "Control which ENTRY operator features are exposed as backend capabilities come online.",
  },
  {
    title: "Community defaults",
    description:
      "Define default onboarding preferences, labels, and baseline configuration for new communities.",
  },
  {
    title: "Activation rules",
    description:
      "Prepare the guardrails that govern queue preparation, PIN flows, and future resident activation controls.",
  },
  {
    title: "Notification behavior",
    description:
      "Reserve space for delivery timing, approval rules, and messaging defaults once notifications are connected.",
  },
  {
    title: "Reservable facilities defaults",
    description:
      "Define the baseline rules and default structure for reservable areas in new ENTRY communities.",
  },
];

export default function EntrySettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="ENTRY settings"
        description="Product-level configuration and feature guardrails for ENTRY."
      />

      <section className="grid gap-4 md:grid-cols-2">
        {settingsCards.map((card) => (
          <article
            key={card.title}
            className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur"
          >
            <div className="inline-flex items-center rounded-full bg-violet-500/12 px-2.5 py-1 text-xs font-semibold text-violet-200 ring-1 ring-inset ring-violet-400/20">
              Pending
            </div>
            <h2 className="mt-4 text-xl font-semibold text-white">{card.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              {card.description}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
