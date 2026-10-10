type FinancialAmountOptions = {
  currency?: string | null;
  estimated?: boolean;
  missingFx?: boolean;
  unknownLabel?: string;
};

const currencySymbols: Record<string, string> = {
  HNL: "L ",
  USD: "$",
};

function decimalParts(value: string | number) {
  const raw = typeof value === "number" ? value.toString() : value.trim();
  if (!raw || raw.toLowerCase() === "nan") return null;
  if (/e/i.test(raw)) {
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) return null;
    return decimalParts(Math.abs(numeric) < 0.01 && numeric !== 0 ? numeric.toFixed(8) : numeric.toFixed(2));
  }

  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [integer = "0", fraction = ""] = unsigned.split(".");
  if (!/^\d+$/.test(integer) || (fraction && !/^\d+$/.test(fraction))) return null;

  return {
    negative,
    integer: integer.replace(/^0+(?=\d)/, "") || "0",
    fraction,
  };
}

function isSubcent(parts: NonNullable<ReturnType<typeof decimalParts>>) {
  if (parts.integer !== "0") return false;
  const padded = parts.fraction.padEnd(2, "0");
  return Number(`0.${padded}`) > 0 && Number(`0.${padded}`) < 0.01;
}

function groupInteger(value: string) {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatFinancialAmount(
  value: string | number | null | undefined,
  options: FinancialAmountOptions = {},
) {
  if (options.missingFx) return "FX unavailable";
  if (value === null || value === undefined || value === "") return options.unknownLabel ?? "Unknown";

  const parts = decimalParts(value);
  if (!parts) return options.unknownLabel ?? "Unknown";

  const currency = (options.currency ?? "USD").toUpperCase();
  const symbol = currencySymbols[currency] ?? `${currency} `;
  const precision = isSubcent(parts) ? 8 : 2;
  const fraction = parts.fraction.padEnd(precision, "0").slice(0, precision);
  const sign = parts.negative ? "-" : "";
  const suffix = options.estimated ? " est." : "";

  return `${sign}${symbol}${groupInteger(parts.integer)}.${fraction}${suffix}`;
}

export function formatDecimalAmount(value: string | number | null | undefined, digits = 2) {
  if (value === null || value === undefined || value === "") return "Unknown";
  const parts = decimalParts(value);
  if (!parts) return "Unknown";
  return `${parts.negative ? "-" : ""}${groupInteger(parts.integer)}.${parts.fraction.padEnd(digits, "0").slice(0, digits)}`;
}
