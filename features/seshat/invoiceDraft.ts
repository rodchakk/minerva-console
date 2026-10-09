export function normalizeInvoiceCurrency(value: string | null | undefined, fallback = "USD") {
  return value?.trim().toUpperCase() || fallback;
}

export function formatInvoiceDraftTotal(value: number, currency: string) {
  const normalizedCurrency = normalizeInvoiceCurrency(currency);

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCurrency,
    }).format(value);
  } catch {
    return `${normalizedCurrency} ${value.toFixed(2)}`;
  }
}
