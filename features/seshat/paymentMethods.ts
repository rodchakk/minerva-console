import type {
  Client,
  ClientPaymentMethodPreference,
  InvoicePaymentMethodSelection,
  PaymentMethod,
} from "./types";

export type ParsedPaymentMethodChoice<T extends string> = {
  selection: T;
  paymentMethodId: string | null;
};

export function paymentMethodLabel(method: PaymentMethod) {
  return method.display_name || method.name;
}

export function parseClientPaymentMethodChoice(
  value: string,
): ParsedPaymentMethodChoice<ClientPaymentMethodPreference> {
  if (value.startsWith("method:")) {
    return { selection: "specific", paymentMethodId: value.slice("method:".length) || null };
  }
  return {
    selection: value === "none" ? "none" : "default",
    paymentMethodId: null,
  };
}

export function parseInvoicePaymentMethodChoice(
  value: string,
): ParsedPaymentMethodChoice<InvoicePaymentMethodSelection> {
  if (value.startsWith("method:")) {
    return { selection: "specific", paymentMethodId: value.slice("method:".length) || null };
  }
  const selection = value === "default" || value === "none" ? value : "auto";
  return { selection, paymentMethodId: null };
}

export function clientPaymentMethodChoice(client?: Client | null) {
  if (client?.payment_method_preference === "specific" && client.preferred_payment_method_id) {
    return `method:${client.preferred_payment_method_id}`;
  }
  return client?.payment_method_preference === "none" ? "none" : "default";
}

export function invoicePaymentMethodChoice(
  selection: InvoicePaymentMethodSelection,
  paymentMethodId: string | null,
) {
  return selection === "specific" && paymentMethodId ? `method:${paymentMethodId}` : selection;
}

export function resolveClientPaymentMethod(client: Client | null | undefined, methods: PaymentMethod[]) {
  const activeMethods = methods.filter((method) => method.is_active);
  if (client?.payment_method_preference === "none") return null;
  if (client?.payment_method_preference === "specific") {
    const preferred = activeMethods.find((method) => method.id === client.preferred_payment_method_id);
    if (preferred) return preferred;
  }
  return activeMethods.find((method) => method.is_default) ?? null;
}
