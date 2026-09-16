"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { createClient } from "@/lib/supabase/server";
import type { BillingPreferredChannel, CustomerStatus } from "./queries";

export type CustomerFormState = {
  message?: string;
};

type CustomerContactInput = {
  email: string;
  is_primary: boolean;
  name: string;
  phone: string;
  role: string;
};

type AdditionalContactInput = {
  email?: unknown;
  name?: unknown;
  phone?: unknown;
  role?: unknown;
};

function normalizeText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function normalizeOptionalText(value: FormDataEntryValue | null) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeStatus(value: string): CustomerStatus | null {
  if (value === "active" || value === "inactive") {
    return value;
  }

  return null;
}

function normalizeBillingChannel(value: string): BillingPreferredChannel | null {
  if (!value) {
    return "";
  }

  if (value === "email" || value === "whatsapp" || value === "other") {
    return value;
  }

  return null;
}

function normalizeDate(value: string) {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return undefined;
}

function parseAdditionalContacts(rawValue: string) {
  if (!rawValue.trim()) {
    return [] as AdditionalContactInput[];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsed) ? (parsed as AdditionalContactInput[]) : null;
  } catch {
    return null;
  }
}

function getAdditionalContactValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildContacts(formData: FormData) {
  const primaryName = normalizeText(formData.get("primary_contact_name"));
  const primaryPhone = normalizeText(formData.get("primary_contact_phone"));
  const primaryEmail = normalizeText(formData.get("primary_contact_email"));
  const rawAdditionalContacts = normalizeText(formData.get("additional_contacts_json"));
  const additionalContacts = parseAdditionalContacts(rawAdditionalContacts);

  if (!primaryName) {
    return {
      error: "Primary contact name is required.",
      contacts: [] as CustomerContactInput[],
    };
  }

  if (!additionalContacts) {
    return {
      error: "Additional contacts could not be read. Try removing and adding them again.",
      contacts: [] as CustomerContactInput[],
    };
  }

  const contacts: CustomerContactInput[] = [
    {
      email: primaryEmail,
      is_primary: true,
      name: primaryName,
      phone: primaryPhone,
      role: "Primary Contact",
    },
  ];

  for (const contact of additionalContacts) {
    const name = getAdditionalContactValue(contact.name);
    const phone = getAdditionalContactValue(contact.phone);
    const email = getAdditionalContactValue(contact.email);
    const role = getAdditionalContactValue(contact.role);
    const hasAnyValue = Boolean(name || phone || email || role);

    if (!hasAnyValue) {
      continue;
    }

    if (!name) {
      return {
        error: "Additional contacts need a full name, or the block can be removed.",
        contacts: [] as CustomerContactInput[],
      };
    }

    contacts.push({
      email,
      is_primary: false,
      name,
      phone,
      role,
    });
  }

  return { contacts };
}

function getRpcErrorMessage(message: string) {
  if (message.includes("entry_customer_profiles_community_unique")) {
    return "That community already has a customer profile.";
  }

  if (message.includes("duplicate key")) {
    return "That community already has a customer profile.";
  }

  if (message.includes("community_not_found")) {
    return "Choose an existing ENTRY community.";
  }

  if (message.includes("customer_not_found")) {
    return "Customer profile was not found.";
  }

  if (message.includes("exactly_one_primary_contact_required")) {
    return "A customer profile must have exactly one primary contact.";
  }

  return message || "Customer profile could not be saved.";
}

async function saveCustomerProfile(
  customerId: string | null,
  formData: FormData,
): Promise<CustomerFormState> {
  await requireSuperadmin();

  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { message: previewReadOnlyError };
  }

  const customerName = normalizeText(formData.get("customer_name"));
  const communityId = normalizeText(formData.get("community_id"));
  const status = normalizeStatus(normalizeText(formData.get("status")));
  const billingPreferredChannel = normalizeBillingChannel(
    normalizeText(formData.get("billing_preferred_channel")),
  );
  const contractDate = normalizeDate(normalizeText(formData.get("contract_date")));
  const contactResult = buildContacts(formData);

  if (!customerName) {
    return { message: "Customer name is required." };
  }

  if (!communityId) {
    return { message: "Linked ENTRY community is required." };
  }

  if (!status) {
    return { message: "Choose Active or Inactive status." };
  }

  if (billingPreferredChannel === null) {
    return { message: "Choose a valid billing preferred channel." };
  }

  if (contractDate === undefined) {
    return { message: "Contract date must use YYYY-MM-DD format." };
  }

  if (contactResult.error) {
    return { message: contactResult.error };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_entry_customer_profile_v1", {
    p_billing_contact_name: normalizeOptionalText(
      formData.get("billing_contact_name"),
    ),
    p_billing_email: normalizeOptionalText(formData.get("billing_email")),
    p_billing_notes: normalizeOptionalText(formData.get("billing_notes")),
    p_billing_preferred_channel: billingPreferredChannel || null,
    p_community_id: communityId,
    p_contacts: contactResult.contacts,
    p_contract_date: contractDate,
    p_customer_id: customerId,
    p_customer_name: customerName,
    p_internal_notes: normalizeOptionalText(formData.get("internal_notes")),
    p_legal_name: normalizeOptionalText(formData.get("legal_name")),
    p_status: status,
    p_tax_id: normalizeOptionalText(formData.get("tax_id")),
  });

  if (error) {
    return { message: getRpcErrorMessage(error.message) };
  }

  const savedCustomerId = typeof data === "string" ? data : customerId;

  if (!savedCustomerId) {
    return { message: "Customer profile was saved, but its ID was not returned." };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${savedCustomerId}`);
  revalidatePath(`/products/entry/communities/${communityId}`);

  redirect(`/customers/${savedCustomerId}`);
}

export async function createCustomerProfileAction(
  _previousState: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  return saveCustomerProfile(null, formData);
}

export async function updateCustomerProfileAction(
  customerId: string,
  _previousState: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  return saveCustomerProfile(customerId, formData);
}
