"use client";

import { getSeshatDataClient, getSeshatSupabase } from "./supabase";
import type {
  AutomaticBillingRunResult,
  DueClientServiceOccurrence,
  GenerateInvoiceResult,
  InvoiceStatus,
  Json,
  RecordPaymentResult,
} from "./types";

export type FinancialInvoiceItemInput = {
  service_id?: string | null;
  name: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  sort_order?: number;
};

export type GenerateInvoiceInput = {
  client_id?: string | null;
  status?: Extract<InvoiceStatus, "draft" | "sent">;
  issue_date?: string | null;
  due_date?: string | null;
  currency?: string | null;
  billing_period_start?: string | null;
  billing_period_end?: string | null;
  source_system?: string;
  source_entity_type?: string | null;
  source_entity_id?: string | null;
  external_reference?: string | null;
  auto_generated?: boolean;
  notes?: string | null;
  internal_notes?: string | null;
  items: FinancialInvoiceItemInput[];
};

export type RecordPaymentInput = {
  invoice_id: string;
  amount: number;
  payment_date?: string | null;
  payment_method?: string | null;
  reference?: string | null;
  notes?: string | null;
  source_system?: string;
  source_entity_type?: string | null;
  source_entity_id?: string | null;
  external_reference?: string | null;
};

function cleanText(value?: string | null) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

export function seshatErrorMessage(error: unknown, fallback: string) {
  const candidate = error as { code?: string; message?: string; details?: string } | null;
  const message = String(candidate?.message ?? "");
  const details = String(candidate?.details ?? "");
  const combined = `${message} ${details}`.toLowerCase();

  if (candidate?.code === "23505") return "This financial operation was already recorded.";
  if (combined.includes("exceed the invoice balance")) return "Payment would exceed the invoice balance.";
  if (combined.includes("cancelled invoice")) return "Payments cannot be recorded against a cancelled invoice.";
  if (combined.includes("only draft invoices can be permanently deleted")) {
    return "Only draft invoices can be permanently deleted.";
  }
  if (combined.includes("invoices with recorded payments cannot be cancelled")) {
    return "Invoices with recorded payments cannot be cancelled until payment reversals are supported.";
  }
  if (combined.includes("invoice total cannot be reduced below recorded payments")) {
    return "Invoice total cannot be reduced below recorded payments.";
  }
  if (combined.includes("billing schedule cannot be changed")) {
    return "Billing schedule cannot be changed after automatic invoices have been generated.";
  }
  if (combined.includes("billed client services cannot be deleted")) {
    return "Billed client services cannot be deleted. Deactivate or end the service instead.";
  }
  if (candidate?.code === "42501" || combined.includes("permission denied")) {
    return "You do not have permission to perform this Seshat operation.";
  }

  return message || fallback;
}

export async function generateInvoice(input: GenerateInvoiceInput): Promise<GenerateInvoiceResult> {
  if (input.items.length === 0) throw new Error("Add at least one invoice item.");
  const db = getSeshatDataClient();

  const items = input.items.map((item, idx) => ({
    service_id: item.service_id ?? null,
    name: item.name.trim(),
    description: cleanText(item.description),
    quantity: item.quantity,
    unit_price: item.unit_price,
    sort_order: item.sort_order ?? idx,
  }));

  const { data, error } = await db
    .rpc("generate_invoice", {
      p_client_id: input.client_id ?? null,
      p_status: input.status ?? "draft",
      p_issue_date: input.issue_date ?? null,
      p_due_date: input.due_date ?? null,
      p_currency: cleanText(input.currency),
      p_billing_period_start: input.billing_period_start ?? null,
      p_billing_period_end: input.billing_period_end ?? null,
      p_source_system: input.source_system ?? "seshat-web",
      p_source_entity_type: cleanText(input.source_entity_type),
      p_source_entity_id: cleanText(input.source_entity_id),
      p_external_reference: cleanText(input.external_reference),
      p_auto_generated: input.auto_generated ?? false,
      p_notes: cleanText(input.notes),
      p_internal_notes: cleanText(input.internal_notes),
      p_items: items as Json,
    })
    .single();

  if (error) throw new Error(seshatErrorMessage(error, "Could not generate invoice."));
  return data as GenerateInvoiceResult;
}

export async function recordPayment(input: RecordPaymentInput): Promise<RecordPaymentResult> {
  const db = getSeshatDataClient();
  const { data, error } = await db
    .rpc("record_payment", {
      p_invoice_id: input.invoice_id,
      p_amount: input.amount,
      p_payment_date: input.payment_date ?? null,
      p_payment_method: cleanText(input.payment_method),
      p_reference: cleanText(input.reference),
      p_notes: cleanText(input.notes),
      p_source_system: input.source_system ?? "seshat-web",
      p_source_entity_type: cleanText(input.source_entity_type),
      p_source_entity_id: cleanText(input.source_entity_id),
      p_external_reference: cleanText(input.external_reference),
    })
    .single();

  if (error) throw new Error(seshatErrorMessage(error, "Could not record payment."));
  return data as RecordPaymentResult;
}

export async function getDueClientServiceOccurrences(asOfDate?: string) {
  const db = getSeshatDataClient();
  const { data, error } = await db.rpc("get_due_client_service_occurrences", {
    p_as_of_date: asOfDate ?? new Date().toISOString().slice(0, 10),
    p_client_id: null,
    p_client_service_ids: null,
  });

  if (error) throw new Error(seshatErrorMessage(error, "Could not load automatic billing preview."));
  return (data as DueClientServiceOccurrence[]) ?? [];
}

export async function runAutomaticBilling(asOfDate?: string): Promise<AutomaticBillingRunResult> {
  const db = getSeshatDataClient();
  const { data, error } = await db
    .rpc("run_client_service_billing", {
      p_as_of_date: asOfDate ?? new Date().toISOString().slice(0, 10),
      p_client_id: null,
      p_client_service_ids: null,
    })
    .single();

  if (error) throw new Error(seshatErrorMessage(error, "Could not run automatic billing."));
  return data as AutomaticBillingRunResult;
}

export async function getPaymentProofSignedUrl(proofPath: string) {
  const { data, error } = await getSeshatSupabase()
    .storage
    .from("payment-proofs")
    .createSignedUrl(proofPath, 300);

  if (error || !data?.signedUrl) {
    throw new Error(seshatErrorMessage(error, "Could not open payment proof."));
  }
  return data.signedUrl;
}
