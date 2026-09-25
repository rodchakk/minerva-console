import type { DueClientServiceOccurrence } from "./types";

export type ClientServiceBillingCurrency = {
  id: string;
  agreed_currency: string | null;
};

export function normalizeBillingCurrency(
  agreedCurrency: string | null | undefined,
  defaultCurrency: string | null | undefined,
) {
  return (agreedCurrency?.trim() || defaultCurrency?.trim() || "USD").toUpperCase();
}

export function expectedAutomaticInvoiceCount(
  dueItems: DueClientServiceOccurrence[],
  currenciesByClientService: ReadonlyMap<string, string | null>,
  defaultCurrency: string | null | undefined,
) {
  return new Set(
    dueItems.map((item) => [
      item.client_id,
      normalizeBillingCurrency(currenciesByClientService.get(item.client_service_id), defaultCurrency),
      item.occurrence_date,
    ].join("|")),
  ).size;
}
