type FinancialAmountOptions = {
  currency?: string | null;
  estimated?: boolean;
  missingFx?: boolean;
  unknownLabel?: string;
};

type DecimalParts = {
  negative: boolean;
  integer: string;
  fraction: string;
};

const currencySymbols: Record<string, string> = {
  HNL: "L ",
  USD: "$",
};

const CENT_PRECISION = 2;
const SUBCENT_PRECISION = 8;

// Presentation policy: normal money rounds to cents, nonzero subcent money
// keeps 8 decimals, and exact halfway values round away from zero. Values too
// small to round to the supported subcent precision display as a threshold.
function decimalParts(value: string | number): DecimalParts | null {
  const raw = typeof value === "number" ? value.toString() : value.trim();
  if (!raw || /^(?:nan|[+-]?infinity)$/i.test(raw)) return null;

  const match = raw.match(/^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:e([+-]?\d+))?$/i);
  if (!match) return null;

  const negative = match[1] === "-";
  let integer = match[2] ?? "0";
  let fraction = match[3] ?? match[4] ?? "";
  const exponent = match[5] ? Number.parseInt(match[5], 10) : 0;

  if (exponent > 0) {
    if (fraction.length <= exponent) {
      integer = `${integer}${fraction.padEnd(exponent, "0")}`;
      fraction = "";
    } else {
      integer = `${integer}${fraction.slice(0, exponent)}`;
      fraction = fraction.slice(exponent);
    }
  } else if (exponent < 0) {
    const shift = Math.abs(exponent);
    if (integer.length <= shift) {
      fraction = `${"0".repeat(shift - integer.length)}${integer}${fraction}`;
      integer = "0";
    } else {
      fraction = `${integer.slice(integer.length - shift)}${fraction}`;
      integer = integer.slice(0, integer.length - shift);
    }
  }

  const normalizedInteger = integer.replace(/^0+(?=\d)/, "") || "0";
  const zero = normalizedInteger === "0" && !/[1-9]/.test(fraction);

  return {
    negative: zero ? false : negative,
    integer: normalizedInteger,
    fraction,
  };
}

function isZero(parts: DecimalParts) {
  return parts.integer === "0" && !/[1-9]/.test(parts.fraction);
}

function isSubcent(parts: DecimalParts) {
  if (parts.integer !== "0") return false;
  if (!/[1-9]/.test(parts.fraction)) return false;
  return parts.fraction.padEnd(CENT_PRECISION, "0").slice(0, CENT_PRECISION) === "00";
}

function groupInteger(value: string) {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function incrementInteger(value: string) {
  const digits = value.split("");
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    const next = Number(digits[index]) + 1;
    if (next < 10) {
      digits[index] = String(next);
      return digits.join("");
    }
    digits[index] = "0";
  }
  return `1${digits.join("")}`;
}

function roundDecimalParts(parts: DecimalParts, precision: number) {
  const digits = Math.max(0, precision);
  let integer = parts.integer;
  let fraction = parts.fraction.padEnd(digits + 1, "0").slice(0, digits);
  const roundDigit = parts.fraction.padEnd(digits + 1, "0")[digits] ?? "0";

  if (roundDigit >= "5") {
    const fractionDigits = fraction.split("");
    let carry = 1;
    for (let index = fractionDigits.length - 1; index >= 0; index -= 1) {
      const next = Number(fractionDigits[index]) + carry;
      if (next < 10) {
        fractionDigits[index] = String(next);
        carry = 0;
        break;
      }
      fractionDigits[index] = "0";
    }
    if (carry === 1) integer = incrementInteger(integer);
    fraction = fractionDigits.join("");
  }

  const roundedZero = integer === "0" && !/[1-9]/.test(fraction);
  return {
    negative: roundedZero ? false : parts.negative,
    integer,
    fraction,
    roundedZero,
  };
}

function thresholdAmount(symbol: string, precision: number, negative: boolean, suffix = "") {
  const threshold = `${symbol}0.${"0".repeat(Math.max(0, precision - 1))}1`;
  return `${negative ? ">" : "<"}${negative ? "-" : ""}${threshold}${suffix}`;
}

function thresholdDecimal(precision: number, negative: boolean) {
  const threshold = `0.${"0".repeat(Math.max(0, precision - 1))}1`;
  return `${negative ? ">-" : "<"}${threshold}`;
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
  const precision = isSubcent(parts) ? SUBCENT_PRECISION : CENT_PRECISION;
  const rounded = roundDecimalParts(parts, precision);
  const suffix = options.estimated ? " est." : "";

  if (!isZero(parts) && rounded.roundedZero) return thresholdAmount(symbol, precision, parts.negative, suffix);

  const sign = rounded.negative ? "-" : "";
  return `${sign}${symbol}${groupInteger(rounded.integer)}.${rounded.fraction}${suffix}`;
}

export function formatDecimalAmount(value: string | number | null | undefined, digits = 2) {
  if (value === null || value === undefined || value === "") return "Unknown";
  const parts = decimalParts(value);
  if (!parts) return "Unknown";
  const rounded = roundDecimalParts(parts, digits);
  if (!isZero(parts) && rounded.roundedZero) return thresholdDecimal(digits, parts.negative);
  return `${rounded.negative ? "-" : ""}${groupInteger(rounded.integer)}.${rounded.fraction}`;
}
