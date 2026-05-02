"use client";

import { Button } from "@/components/ui/Button";

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
  const addField = () => onChange([...value, ""]);

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
      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-900">Reservable areas</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Enable Reservations to add the real facility names for this community.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-slate-900">Reservable areas</h3>
          <p className="text-sm leading-6 text-slate-600">
            Add the reservable areas this community should manage during
            onboarding. Placeholder examples are only suggestions.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={addField}>
          Add area
        </Button>
      </div>

      <div className="mt-5 space-y-3">
        {value.map((facilityName, index) => (
          <div key={`facility-${index}`} className="flex gap-3">
            <input
              value={facilityName}
              onChange={(event) => updateField(index, event.target.value)}
              className="min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 outline-none transition focus:border-teal-600"
              placeholder={
                facilityPlaceholders[index] ??
                `Area ${index + 1}`
              }
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => removeField(index)}
              disabled={value.length === 1}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-500">
        Examples: Casa Club, Piscina, Cancha, Salon social. Type the actual
        names used by this community.
      </p>
    </div>
  );
}
