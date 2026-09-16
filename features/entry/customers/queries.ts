import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createClient } from "@/lib/supabase/server";
import {
  coerceBoolean,
  coerceString,
} from "@/lib/supabase/utils";

export type CustomerStatus = "active" | "inactive";

export type BillingPreferredChannel = "email" | "whatsapp" | "other" | "";

export type CustomerContact = {
  email: string;
  id: string;
  isPrimary: boolean;
  name: string;
  phone: string;
  role: string;
};

export type CustomerCommunityOption = {
  id: string;
  isActive: boolean;
  name: string;
};

export type CustomerProfile = {
  billingContactName: string;
  billingEmail: string;
  billingNotes: string;
  billingPreferredChannel: BillingPreferredChannel;
  community: CustomerCommunityOption | null;
  communityId: string;
  contacts: CustomerContact[];
  contractDate: string;
  createdAt: string;
  customerName: string;
  id: string;
  internalNotes: string;
  legalName: string;
  primaryContact: CustomerContact | null;
  status: CustomerStatus;
  taxId: string;
  updatedAt: string;
};

export type CustomerListItem = Pick<
  CustomerProfile,
  | "billingContactName"
  | "billingEmail"
  | "community"
  | "communityId"
  | "customerName"
  | "id"
  | "primaryContact"
  | "status"
  | "updatedAt"
>;

function recordFrom(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function arrayFrom(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeDate(value: string) {
  if (!value) return "";
  return value.slice(0, 10);
}

export function formatCustomerDate(value: string, fallback = "Not set") {
  if (!value) return fallback;

  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
      )
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}

export function formatCustomerStatus(value: CustomerStatus) {
  return value === "active" ? "Active" : "Inactive";
}

export function formatBillingChannel(value: BillingPreferredChannel) {
  if (value === "email") return "Email";
  if (value === "whatsapp") return "WhatsApp";
  if (value === "other") return "Other";
  return "Not set";
}

function normalizeStatus(value: string): CustomerStatus {
  return value === "inactive" ? "inactive" : "active";
}

function normalizeBillingChannel(value: string): BillingPreferredChannel {
  if (value === "email" || value === "whatsapp" || value === "other") {
    return value;
  }

  return "";
}

function normalizeCommunity(value: unknown): CustomerCommunityOption | null {
  const record = recordFrom(value);
  const id = coerceString(record.id);

  if (!id) {
    return null;
  }

  return {
    id,
    isActive: record.is_active === undefined ? true : coerceBoolean(record.is_active),
    name: coerceString(record.name, "Untitled community"),
  };
}

function normalizeContact(value: unknown): CustomerContact | null {
  const record = recordFrom(value);
  const id = coerceString(record.id);
  const name = coerceString(record.name);

  if (!id || !name) {
    return null;
  }

  return {
    email: coerceString(record.email),
    id,
    isPrimary: coerceBoolean(record.is_primary),
    name,
    phone: coerceString(record.phone),
    role: coerceString(record.role),
  };
}

function normalizeCustomerProfile(value: unknown): CustomerProfile | null {
  const record = recordFrom(value);
  const id = coerceString(record.id);
  const communityId = coerceString(record.community_id);

  if (!id || !communityId) {
    return null;
  }

  const contacts = arrayFrom(record.entry_customer_contacts)
    .map(normalizeContact)
    .filter((contact): contact is CustomerContact => contact !== null)
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) {
        return a.isPrimary ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    });

  return {
    billingContactName: coerceString(record.billing_contact_name),
    billingEmail: coerceString(record.billing_email),
    billingNotes: coerceString(record.billing_notes),
    billingPreferredChannel: normalizeBillingChannel(
      coerceString(record.billing_preferred_channel),
    ),
    community: normalizeCommunity(record.communities),
    communityId,
    contacts,
    contractDate: normalizeDate(coerceString(record.contract_date)),
    createdAt: coerceString(record.created_at),
    customerName: coerceString(record.customer_name, "Untitled customer"),
    id,
    internalNotes: coerceString(record.internal_notes),
    legalName: coerceString(record.legal_name),
    primaryContact: contacts.find((contact) => contact.isPrimary) ?? null,
    status: normalizeStatus(coerceString(record.status)),
    taxId: coerceString(record.tax_id),
    updatedAt: coerceString(record.updated_at),
  };
}

function matchesCustomerQuery(customer: CustomerProfile, query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [
    customer.customerName,
    customer.community?.name ?? "",
    customer.primaryContact?.name ?? "",
    customer.billingContactName,
    customer.billingEmail,
    customer.legalName,
    customer.taxId,
    ...customer.contacts.flatMap((contact) => [
      contact.name,
      contact.email,
      contact.phone,
      contact.role,
    ]),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export async function listCustomerProfiles(input?: {
  query?: string;
  status?: string;
}): Promise<CustomerListItem[]> {
  await requireSuperadmin();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entry_customer_profiles")
    .select(
      `
        id,
        community_id,
        customer_name,
        status,
        billing_contact_name,
        billing_email,
        updated_at,
        communities (
          id,
          name,
          is_active
        ),
        entry_customer_contacts (
          id,
          name,
          phone,
          email,
          role,
          is_primary
        )
      `,
    )
    .order("updated_at", { ascending: false });

  if (error || !Array.isArray(data)) {
    return [];
  }

  const status = input?.status === "inactive" ? "inactive" : input?.status === "all" ? "all" : "active";
  const query = input?.query ?? "";

  return data
    .map(normalizeCustomerProfile)
    .filter((customer): customer is CustomerProfile => customer !== null)
    .filter((customer) => status === "all" || customer.status === status)
    .filter((customer) => matchesCustomerQuery(customer, query));
}

export async function getCustomerProfile(customerId: string): Promise<CustomerProfile | null> {
  await requireSuperadmin();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entry_customer_profiles")
    .select(
      `
        id,
        community_id,
        customer_name,
        status,
        contract_date,
        billing_contact_name,
        billing_email,
        billing_preferred_channel,
        billing_notes,
        legal_name,
        tax_id,
        internal_notes,
        created_at,
        updated_at,
        communities (
          id,
          name,
          is_active
        ),
        entry_customer_contacts (
          id,
          name,
          phone,
          email,
          role,
          is_primary,
          created_at
        )
      `,
    )
    .eq("id", customerId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeCustomerProfile(data);
}

export async function getCustomerProfileForCommunity(
  communityId: string,
): Promise<Pick<CustomerProfile, "customerName" | "id" | "status"> | null> {
  await requireSuperadmin();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entry_customer_profiles")
    .select("id, customer_name, status, community_id")
    .eq("community_id", communityId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const profile = normalizeCustomerProfile(data);

  if (!profile) {
    return null;
  }

  return {
    customerName: profile.customerName,
    id: profile.id,
    status: profile.status,
  };
}

export async function listCustomerCommunityOptions(): Promise<CustomerCommunityOption[]> {
  await requireSuperadmin();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("communities")
    .select("id, name, is_active")
    .order("name", { ascending: true });

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data
    .map(normalizeCommunity)
    .filter((community): community is CustomerCommunityOption => community !== null);
}
