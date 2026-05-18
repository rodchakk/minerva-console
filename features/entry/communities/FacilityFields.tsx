"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
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
      <div className="rounded-[26px] border border-dashed border-[var(--border-strong)] bg-[rgba(12,17,25,0.72)] px-5 py-5">
        <h3 className="text-base font-semibold text-white">Reservable areas</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          Enable Reservations to add the real facility names for this community.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[26px] border border-white/8 bg-[rgba(12,17,25,0.58)] p-5">
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-white">Reservable areas</h3>
        <p className="text-sm leading-6 text-[var(--text-muted)]">
          Add the amenities or spaces this community can manage.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3 lg:flex-row">
        <input
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addFacilityFromDraft();
            }
          }}
          className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-4 text-sm text-slate-100 outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-400/50"
          placeholder="Add area name"
        />
        <Button
          type="button"
          variant="secondary"
          className="h-12 px-5"
          onClick={addFacilityFromDraft}
        >
          Add area
        </Button>
      </div>

      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
        Press Enter to add more areas.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        {normalizedFacilities.length > 0 ? (
          normalizedFacilities.map((facility) => (
            <span
              key={`facility-chip-${facility.name}-${facility.index}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[var(--surface-strong)] px-3.5 py-2 text-sm text-slate-100 shadow-[0_10px_24px_rgba(2,6,23,0.16)]"
            >
              <span>{facility.name}</span>
              <button
                type="button"
                onClick={() => removeField(facility.index)}
                aria-label={`Remove ${facility.name}`}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-white/8 hover:text-white"
              >
                ×
              </button>
            </span>
          ))
        ) : (
          facilityPlaceholders.map((facilityName) => (
            <span
              key={`facility-placeholder-${facilityName}`}
              className="inline-flex items-center rounded-full border border-dashed border-white/10 px-3.5 py-2 text-sm text-[var(--text-muted)]"
            >
              {facilityName}
            </span>
          ))
        )}
      </div>

      {shouldShowPendingFields ? (
        <div className="mt-5 space-y-3 border-t border-white/8 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-200">Pending area names</p>
              <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                Finish or remove any blank entries already added to the list.
              </p>
            </div>
            <Button type="button" variant="ghost" onClick={addField}>
              Add another field
            </Button>
          </div>

          <div className="space-y-3">
            {value.map((facilityName, index) => (
              <div
                key={`facility-${index}`}
                className={cn(
                  "flex flex-col gap-3 sm:flex-row",
                  facilityName.trim() === "" ? "block" : "hidden",
                )}
              >
                <input
                  value={facilityName}
                  onChange={(event) => updateField(index, event.target.value)}
                  className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-4 text-sm text-slate-100 outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-400/50"
                  placeholder={facilityPlaceholders[index] ?? `Area ${index + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="sm:self-center"
                  onClick={() => removeField(index)}
                  disabled={value.length === 1}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
        Examples: Casa Club, Piscina, Cancha, Salon social.
      </p>
    </div>
  );
}
