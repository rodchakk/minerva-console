"use client";

import { AdvancedUnitsImport } from "@/features/entry/communities/AdvancedUnitsImport";
import type { AdvancedUnitsImportPayload } from "@/features/entry/communities/unitsImport";
import { cn } from "@/lib/supabase/utils";

type BulkUnitsUploaderProps = {
  advancedValue: AdvancedUnitsImportPayload | null;
  mode: "advanced" | "simple";
  onAdvancedChange: (value: AdvancedUnitsImportPayload | null) => void;
  onModeChange: (value: "advanced" | "simple") => void;
  onSimpleChange: (value: string) => void;
  simpleValue: string;
};

export function BulkUnitsUploader({
  advancedValue,
  mode,
  onAdvancedChange,
  onModeChange,
  onSimpleChange,
  simpleValue,
}: BulkUnitsUploaderProps) {
  return (
    <div className="space-y-5">
      <nav
        aria-label="Units upload mode"
        className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface-raised)] p-1"
      >
        <button
          type="button"
          onClick={() => onModeChange("simple")}
          className={cn(
            "inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50",
            mode === "simple"
              ? "bg-[var(--console-accent-subtle)] text-violet-100 ring-1 ring-inset ring-[var(--console-accent-border)]"
              : "text-[var(--console-text-muted)] hover:bg-white/[0.035] hover:text-slate-100",
          )}
        >
          Manual units
        </button>
        <button
          type="button"
          onClick={() => onModeChange("advanced")}
          className={cn(
            "inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50",
            mode === "advanced"
              ? "bg-[var(--console-accent-subtle)] text-violet-100 ring-1 ring-inset ring-[var(--console-accent-border)]"
              : "text-[var(--console-text-muted)] hover:bg-white/[0.035] hover:text-slate-100",
          )}
        >
          Resident import
        </button>
      </nav>

      {mode === "simple" ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold text-white">Add units manually</h3>
            <p className="mt-0.5 text-xs text-[var(--console-text-muted)]">
              Add one unit per line. Best for small communities.
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--console-text-muted)]"
              htmlFor="units_input"
            >
              Units list
            </label>
            <textarea
              id="units_input"
              name="units_input"
              rows={7}
              value={simpleValue}
              onChange={(event) => onSimpleChange(event.target.value)}
              className="w-full rounded-md border border-[var(--console-border)] bg-[var(--console-surface-raised)] p-3 text-sm text-slate-100 outline-none transition placeholder:text-[var(--console-text-soft)] focus:border-[var(--console-accent-border)]"
              placeholder={"Casa 1\nCasa 2\nCasa 3"}
            />
            <p className="text-xs text-[var(--console-text-muted)]">
              Each line will be added as a unit in this community.
            </p>
          </div>
        </div>
      ) : (
        <AdvancedUnitsImport value={advancedValue} onChange={onAdvancedChange} />
      )}
    </div>
  );
}
