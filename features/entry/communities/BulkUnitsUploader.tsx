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
    <div className="space-y-6">
      <div className="inline-flex rounded-full border border-white/8 bg-white/[0.03] p-1">
        <button
          type="button"
          onClick={() => onModeChange("simple")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            mode === "simple"
              ? "bg-[linear-gradient(180deg,rgba(109,99,255,0.24),rgba(78,67,202,0.22))] text-white ring-1 ring-inset ring-violet-400/30"
              : "text-[var(--text-muted)] hover:text-white"
          }`}
        >
          Manual units
        </button>
        <button
          type="button"
          onClick={() => onModeChange("advanced")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            mode === "advanced"
              ? "bg-[linear-gradient(180deg,rgba(109,99,255,0.24),rgba(78,67,202,0.22))] text-white ring-1 ring-inset ring-violet-400/30"
              : "text-[var(--text-muted)] hover:text-white"
          }`}
        >
          Resident import
        </button>
      </div>

      {mode === "simple" ? (
        <div className="space-y-5">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-white">Add units manually</h3>
            <p className="text-sm leading-6 text-[var(--text-muted)]">
              Add one unit per line. Best for small communities.
            </p>
          </div>

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
            className="w-full rounded-[26px] border border-white/10 bg-[var(--surface-strong)] px-4 py-4 text-slate-100 outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-400/50"
            placeholder={"Casa 1\nCasa 2\nCasa 3"}
          />
          <p className="text-sm leading-6 text-[var(--text-muted)]">
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
