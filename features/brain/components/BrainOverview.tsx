import Link from "next/link";
import { getBrainCounts } from "@/features/brain/lib/content";

type Card = {
  label: string;
  href: string;
  hint: string;
};

const cards: Card[] = [
  {
    label: "Projects",
    href: "/brain/projects",
    hint: "Minerva products and internal projects, with context and boundaries.",
  },
  {
    label: "Decisions",
    href: "/brain/decisions",
    hint: "Approved architectural and product decisions. Append-only.",
  },
  {
    label: "Prompts",
    href: "/brain/prompts",
    hint: "Versioned prompts run against AI models.",
  },
  {
    label: "Agents",
    href: "/brain/agents",
    hint: "Internal agent definitions and boundaries.",
  },
  {
    label: "Inbox",
    href: "/brain/inbox",
    hint: "Raw, unprocessed AI outputs awaiting triage. Not yet knowledge.",
  },
  {
    label: "Search",
    href: "/brain/search",
    hint: "Search across all Brain registries and Markdown documents.",
  },
  {
    label: "Tags",
    href: "/brain/tags",
    hint: "Browse all tags used across Brain entries.",
  },
];

export function BrainOverview() {
  const counts = getBrainCounts();
  const valueOf: Record<string, number> = {
    Projects: counts.projects,
    Decisions: counts.decisions,
    Prompts: counts.prompts,
    Agents: counts.agents,
    Inbox: counts.inbox,
  };

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur transition-colors hover:border-white/20"
        >
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm font-medium text-[var(--text-muted)]">
              {card.label}
            </p>
            {card.label in valueOf ? (
              <p className="text-3xl font-semibold tracking-tight text-white">
                {valueOf[card.label]}
              </p>
            ) : null}
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
            {card.hint}
          </p>
        </Link>
      ))}
    </section>
  );
}
