"use client";

import { useEffect, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";

export function OnboardingGuideTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Onboarding steps guide"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-violet-300 transition-colors hover:bg-violet-500/10 hover:text-violet-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-400/50"
      >
        <CircleHelp className="h-4 w-4 shrink-0 stroke-[1.75] text-violet-400" />
        <span>Onboarding steps</span>
      </button>

      {isOpen ? (
        <div
          role="region"
          aria-label="Onboarding instructions"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface-raised)] p-4 shadow-xl backdrop-blur"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
            Onboarding Guide
          </p>
          <p className="mt-1.5 text-xs leading-5 text-slate-200">
            Here will live onboarding steps.
          </p>
        </div>
      ) : null}
    </div>
  );
}
