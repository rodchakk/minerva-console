import type { InvoiceStatus } from "./types";

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
    statuses: {
      draft: "Draft",
      sent: "Sent",
      paid: "Paid",
      overdue: "Overdue",
      cancelled: "Cancelled",
    },
  },
};

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
