import type { InvoicePaymentInstructionSnapshot, InvoiceStatus } from "./types";

export type InvoiceDocumentLanguage = "es-HN" | "en-US";

export const DEFAULT_INVOICE_DOCUMENT_LANGUAGE: InvoiceDocumentLanguage = "es-HN";

type InvoiceDocumentCopy = {
  invoice: string;
  billTo: string;
  issueDate: string;
  dueDate: string;
  paidDate: string;
  currency: string;
  item: string;
  quantity: string;
  unitPrice: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  paid: string;
  balanceDue: string;
  paymentInformation: string;
  bankInformation: string;
  totalPayable: string;
  footerTagline: string;
  bank: string;
  accountNumber: string;
  accountHolder: string;
  accountType: string;
  paymentCurrency: string;
  instructions: string;
  account: string;
  paymentLink: string;
  methodTypes: Record<InvoicePaymentInstructionSnapshot["method_type"], string>;
  statuses: Record<InvoiceStatus, string>;
};

export const invoiceDocumentCopy: Record<InvoiceDocumentLanguage, InvoiceDocumentCopy> = {
  "es-HN": {
    invoice: "Factura",
    billTo: "Facturar a",
    issueDate: "Fecha de emisión",
    dueDate: "Fecha de vencimiento",
    paidDate: "Fecha de pago",
    currency: "Moneda",
    item: "Concepto",
    quantity: "Cant.",
    unitPrice: "Precio unitario",
    subtotal: "Subtotal",
    discount: "Descuento",
    tax: "Impuesto",
    total: "Total",
    paid: "Pagado",
    balanceDue: "Saldo pendiente",
    paymentInformation: "Información de pago",
    bankInformation: "Información bancaria",
    totalPayable: "Total a pagar",
    footerTagline: "Soluciones tecnológicas para administración y operación residencial.",
    bank: "Banco",
    accountNumber: "Número de cuenta",
    accountHolder: "Titular",
    accountType: "Tipo de cuenta",
    paymentCurrency: "Moneda",
    instructions: "Instrucciones",
    account: "Cuenta",
    paymentLink: "Enlace de pago",
    methodTypes: { bank_transfer: "Transferencia bancaria", paypal: "PayPal", cash: "Efectivo", other: "Otro" },
    statuses: {
      draft: "Borrador",
      sent: "Enviada",
      paid: "Pagada",
      overdue: "Vencida",
      cancelled: "Cancelada",
    },
  },
  "en-US": {
    invoice: "Invoice",
    billTo: "Bill to",
    issueDate: "Issue date",
    dueDate: "Due date",
    paidDate: "Paid date",
    currency: "Currency",
    item: "Item",
    quantity: "Qty",
    unitPrice: "Unit",
    subtotal: "Subtotal",
    discount: "Discount",
    tax: "Tax",
    total: "Total",
    paid: "Paid",
    balanceDue: "Balance due",
    paymentInformation: "Payment information",
    bankInformation: "Bank information",
    totalPayable: "Total",
    footerTagline: "Technology solutions for residential administration and operations.",
    bank: "Bank",
    accountNumber: "Account number",
    accountHolder: "Account holder",
    accountType: "Account type",
    paymentCurrency: "Currency",
    instructions: "Instructions",
    account: "Account",
    paymentLink: "Payment link",
    methodTypes: { bank_transfer: "Bank transfer", paypal: "PayPal", cash: "Cash", other: "Other" },
    statuses: {
      draft: "Draft",
      sent: "Sent",
      paid: "Paid",
      overdue: "Overdue",
      cancelled: "Cancelled",
    },
  },
};

export type PaymentInstructionRow = { label: string; value: string; isLink?: boolean };

export function paymentInstructionPresentation(
  snapshot: InvoicePaymentInstructionSnapshot,
  language: InvoiceDocumentLanguage,
) {
  const copy = invoiceDocumentCopy[language];
  const rows: PaymentInstructionRow[] = [];
  const add = (label: string, value?: string, isLink = false) => {
    if (value?.trim()) rows.push({ label, value: value.trim(), isLink });
  };

  if (snapshot.method_type === "bank_transfer") {
    add(copy.bank, snapshot.bank_name);
    add(copy.accountNumber, snapshot.account_number);
    add(copy.accountHolder, snapshot.account_holder);
    add(copy.accountType, snapshot.account_type);
    add(copy.paymentCurrency, snapshot.currency);
  } else if (snapshot.method_type === "paypal") {
    add(copy.account, snapshot.paypal_email);
    add(copy.paymentLink, snapshot.payment_url, true);
    add(copy.paymentCurrency, snapshot.currency);
  } else {
    add(copy.paymentLink, snapshot.payment_url, true);
    add(copy.paymentCurrency, snapshot.currency);
  }
  add(copy.instructions, snapshot.instructions);

  return {
    heading: snapshot.method_type === "bank_transfer" ? copy.bankInformation : copy.paymentInformation,
    methodName: snapshot.display_name || copy.methodTypes[snapshot.method_type],
    rows,
  };
}

export function formatInvoiceDocumentDate(
  value: string | null | undefined,
  language: InvoiceDocumentLanguage,
) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(language, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function formatInvoiceDocumentMoney(
  value: number | null | undefined,
  currency: string,
  language: InvoiceDocumentLanguage,
) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(language, {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatInvoiceDocumentAmount(
  value: number | null | undefined,
  currency: string,
  language: InvoiceDocumentLanguage,
) {
  if (value == null || Number.isNaN(value)) return "—";
  const amount = new Intl.NumberFormat(language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  if (currency.toUpperCase() === "HNL") return `L ${amount}`;
  return formatInvoiceDocumentMoney(value, currency, language);
}
