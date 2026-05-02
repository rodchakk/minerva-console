"use client";

type BulkUnitsUploaderProps = {
  value: string;
  onChange: (value: string) => void;
};

export function BulkUnitsUploader({
  value,
  onChange,
}: BulkUnitsUploaderProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-slate-700" htmlFor="units_input">
        Units list
      </label>
      <textarea
        id="units_input"
        name="units_input"
        rows={8}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 outline-none transition focus:border-teal-600"
        placeholder={"Casa 1\nCasa 2\nCasa 3"}
      />
      <p className="text-sm leading-6 text-slate-500">
        Paste one unit per line. CSV or spreadsheet-ready paste is supported as
        plain lines for now.
      </p>
    </div>
  );
}
