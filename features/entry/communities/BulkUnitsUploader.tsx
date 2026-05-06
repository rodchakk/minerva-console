"use client";

import { AdvancedUnitsImport } from "@/features/entry/communities/AdvancedUnitsImport";
import type { AdvancedUnitsImportPayload } from "@/features/entry/communities/unitsImport";

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
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onModeChange("simple")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            mode === "simple"
              ? "bg-violet-500/18 text-white ring-1 ring-inset ring-violet-400/30"
              : "bg-white/6 text-[var(--text-muted)] ring-1 ring-inset ring-white/10 hover:bg-white/10"
          }`}
        >
          Simple units
        </button>
        <button
          type="button"
          onClick={() => onModeChange("advanced")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            mode === "advanced"
              ? "bg-violet-500/18 text-white ring-1 ring-inset ring-violet-400/30"
              : "bg-white/6 text-[var(--text-muted)] ring-1 ring-inset ring-white/10 hover:bg-white/10"
          }`}
        >
          Advanced Excel import
        </button>
      </div>

      {mode === "simple" ? (
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-200" htmlFor="units_input">
            Units list
          </label>
          <textarea
            id="units_input"
            name="units_input"
            rows={8}
            value={simpleValue}
            onChange={(event) => onSimpleChange(event.target.value)}
            className="w-full rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-slate-100 outline-none transition focus:border-[var(--primary)]"
            placeholder={"Casa 1\nCasa 2\nCasa 3"}
          />
          <p className="text-sm leading-6 text-[var(--text-muted)]">
            Paste one unit per line. This keeps the fastest manual setup flow for
            small communities.
          </p>
        </div>
      ) : (
        <AdvancedUnitsImport value={advancedValue} onChange={onAdvancedChange} />
      )}
    </div>
  );
}
