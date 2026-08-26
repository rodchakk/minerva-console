"use client";

import { useState } from "react";
import { cn } from "@/lib/supabase/utils";

const facilityPlaceholders = [
  "Casa Club",
  "Piscina",
  "Cancha",
  "Salon social",
];

type FacilityFieldsProps = {
  disabled: boolean;
  onChange: (value: string[]) => void;
  value: string[];
};

export function FacilityFields({
  disabled,
  onChange,
  value,
}: FacilityFieldsProps) {
  const [draftValue, setDraftValue] = useState("");

  const normalizedFacilities = value
    .map((facilityName, index) => ({
      index,
      name: facilityName.trim(),
    }))
    .filter((facility) => facility.name.length > 0);
  const blankFacilityIndexes = value
    .map((facilityName, index) => ({
      index,
      isBlank: facilityName.trim() === "",
    }))
    .filter((facility) => facility.isBlank)
    .map((facility) => facility.index);
  const shouldShowPendingFields =
    blankFacilityIndexes.length > 0 &&
    !(blankFacilityIndexes.length === 1 && normalizedFacilities.length === 0);

  const addField = () => onChange([...value, ""]);

  const addFacilityFromDraft = () => {
    const trimmedValue = draftValue.trim();

    if (!trimmedValue) {
      return;
    }

    onChange([...normalizedFacilities.map((facility) => facility.name), trimmedValue]);
    setDraftValue("");
  };

  const removeField = (index: number) => {
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  };

  const updateField = (index: number, nextValue: string) => {
    onChange(
      value.map((currentValue, itemIndex) =>
        itemIndex === index ? nextValue : currentValue,
      ),
    );
  };

  if (disabled) {
    return (
      <div className="space-y-2 pt-2">
        <div className="border-t border-[var(--console-border)] pb-4" />
        <h3 className="text-base font-semibold text-white">Reservable areas</h3>
        <p className="text-xs leading-5 text-[var(--console-text-muted)]">
          Enable Reservations to add the real facility names for this community.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="border-t border-[var(--console-border)] pb-2" />
      <div>
        <h3 className="text-base font-semibold text-white">Reservable areas</h3>
        <p className="mt-0.5 text-xs text-[var(--console-text-muted)]">
          Add the amenities or spaces this community can manage.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addFacilityFromDraft();
            }
          }}
          className="h-9 min-w-0 flex-1 rounded-md border border-[var(--console-border)] bg-[var(--console-surface-raised)] px-3 text-sm text-slate-100 outline-none transition placeholder:text-[var(--console-text-soft)] focus:border-[var(--console-accent-border)]"
          placeholder="Add area name"
        />
        <button
          type="button"
          onClick={addFacilityFromDraft}
          className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--console-border)] bg-white/[0.025] px-4 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50"
        >
          Add area
        </button>
      </div>

      <p className="text-xs text-[var(--console-text-muted)]">
        Press Enter to add more areas.
      </p>

      <div className="flex flex-wrap gap-2">
        {normalizedFacilities.length > 0 ? (
          normalizedFacilities.map((facility) => (
            <span
              key={`facility-chip-${facility.name}-${facility.index}`}
              className="inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--console-border)] bg-[var(--console-surface-raised)] px-2.5 py-1 text-xs font-medium text-slate-200"
            >
              <span>{facility.name}</span>
              <button
                type="button"
                onClick={() => removeField(facility.index)}
                aria-label={`Remove ${facility.name}`}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[var(--console-text-muted)] transition hover:text-white"
              >
                ×
              </button>
            </span>
          ))
        ) : (
          facilityPlaceholders.map((facilityName) => (
            <span
              key={`facility-placeholder-${facilityName}`}
              className="inline-flex items-center rounded-[4px] border border-dashed border-[var(--console-border-strong)] px-2.5 py-1 text-xs text-[var(--console-text-muted)]"
            >
              {facilityName}
            </span>
          ))
        )}
      </div>

      {shouldShowPendingFields ? (
        <div className="space-y-3 border-t border-[var(--console-border)] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-200">Pending area names</p>
              <p className="mt-0.5 text-xs text-[var(--console-text-muted)]">
                Finish or remove any blank entries already added to the list.
              </p>
            </div>
            <button
              type="button"
              onClick={addField}
              className="inline-flex h-7 items-center justify-center rounded-md border border-[var(--console-border)] bg-transparent px-2.5 text-xs font-semibold text-[var(--console-text-muted)] transition-colors hover:bg-white/[0.04] hover:text-white"
            >
              Add another field
            </button>
          </div>

          <div className="space-y-2">
            {value.map((facilityName, index) => (
              <div
                key={`facility-${index}`}
                className={cn(
                  "flex flex-col gap-2 sm:flex-row",
                  facilityName.trim() === "" ? "block" : "hidden",
                )}
              >
                <input
                  value={facilityName}
                  onChange={(event) => updateField(index, event.target.value)}
                  className="h-8 min-w-0 flex-1 rounded-md border border-[var(--console-border)] bg-[var(--console-surface-raised)] px-3 text-xs text-slate-100 outline-none transition placeholder:text-[var(--console-text-soft)] focus:border-[var(--console-accent-border)]"
                  placeholder={facilityPlaceholders[index] ?? `Area ${index + 1}`}
                />
                <button
                  type="button"
                  onClick={() => removeField(index)}
                  disabled={value.length === 1}
                  className="inline-flex h-8 items-center justify-center rounded-md px-2.5 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/10 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-xs text-[var(--console-text-muted)]">
        Examples: Casa Club, Piscina, Cancha, Salon social.
      </p>
    </div>
  );
}
