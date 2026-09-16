"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  CalendarDays,
  ChevronDown,
  Mail,
  Phone,
  Plus,
  Save,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  createCustomerProfileAction,
  updateCustomerProfileAction,
  type CustomerFormState,
} from "@/features/entry/customers/actions";
import type {
  CustomerCommunityOption,
  CustomerContact,
  CustomerProfile,
} from "@/features/entry/customers/queries";
import { cn } from "@/lib/supabase/utils";

type AdditionalContactDraft = {
  email: string;
  key: string;
  name: string;
  phone: string;
  role: string;
};

type CustomerFormProps = {
  communities: CustomerCommunityOption[];
  initialCommunityId?: string;
  initialCustomer?: CustomerProfile;
};

const fieldClassName =
  "h-9 w-full rounded-md border border-[var(--console-border)] bg-[var(--console-surface-raised)] px-3 text-sm text-slate-100 outline-none transition placeholder:text-[var(--console-text-soft)] focus:border-[var(--console-accent-border)]";

const textareaClassName =
  "min-h-24 w-full rounded-md border border-[var(--console-border)] bg-[var(--console-surface-raised)] px-3 py-2 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-[var(--console-text-soft)] focus:border-[var(--console-accent-border)]";

const sectionClassName =
  "rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-5";

function makeContactKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toAdditionalDraft(contact: CustomerContact): AdditionalContactDraft {
  return {
    email: contact.email,
    key: contact.id || makeContactKey(),
    name: contact.name,
    phone: contact.phone,
    role: contact.role,
  };
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--console-accent)] px-4 text-xs font-semibold text-white transition-colors hover:bg-[var(--console-accent-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Save className="h-4 w-4 stroke-[1.75]" />
      {pending ? "Saving..." : label}
    </button>
  );
}

function FieldLabel({
  children,
  htmlFor,
  required,
}: {
  children: React.ReactNode;
  htmlFor: string;
  required?: boolean;
}) {
  return (
    <label
      className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--console-text-muted)]"
      htmlFor={htmlFor}
    >
      {children}
      {required ? <span className="text-rose-300"> *</span> : null}
    </label>
  );
}

function SectionHeading({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--console-border)] pb-4">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--console-border)] bg-white/[0.025] text-slate-200">
        {icon}
      </span>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
    </div>
  );
}

function InputWithIcon({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--console-text-muted)]">
        {icon}
      </span>
      {children}
    </div>
  );
}

export function CustomerForm({
  communities,
  initialCommunityId,
  initialCustomer,
}: CustomerFormProps) {
  const isEditing = Boolean(initialCustomer);
  const action = initialCustomer
    ? updateCustomerProfileAction.bind(null, initialCustomer.id)
    : createCustomerProfileAction;
  const [state, formAction] = useActionState<CustomerFormState, FormData>(
    action,
    {},
  );
  const primaryContact = initialCustomer?.primaryContact;
  const [additionalContacts, setAdditionalContacts] = useState<AdditionalContactDraft[]>(
    () =>
      initialCustomer?.contacts
        .filter((contact) => !contact.isPrimary)
        .map(toAdditionalDraft) ?? [],
  );
  const defaultCommunityId =
    initialCustomer?.communityId || initialCommunityId || communities[0]?.id || "";
  const additionalContactsJson = useMemo(
    () =>
      JSON.stringify(
        additionalContacts.map(({ email, name, phone, role }) => ({
          email,
          name,
          phone,
          role,
        })),
      ),
    [additionalContacts],
  );

  function updateAdditionalContact(
    key: string,
    field: keyof Omit<AdditionalContactDraft, "key">,
    value: string,
  ) {
    setAdditionalContacts((current) =>
      current.map((contact) =>
        contact.key === key ? { ...contact, [field]: value } : contact,
      ),
    );
  }

  function addAdditionalContact() {
    setAdditionalContacts((current) => [
      ...current,
      {
        email: "",
        key: makeContactKey(),
        name: "",
        phone: "",
        role: "",
      },
    ]);
  }

  function removeAdditionalContact(key: string) {
    setAdditionalContacts((current) =>
      current.filter((contact) => contact.key !== key),
    );
  }

  return (
    <form action={formAction} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <input
        type="hidden"
        name="additional_contacts_json"
        value={additionalContactsJson}
      />

      <div className="space-y-5">
        <section className={sectionClassName}>
          <SectionHeading
            icon={<UserRound className="h-4 w-4 stroke-[1.75]" />}
            title="Customer information"
          />

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5 md:col-span-1">
              <FieldLabel htmlFor="customer_name" required>
                Customer name
              </FieldLabel>
              <input
                id="customer_name"
                name="customer_name"
                required
                defaultValue={initialCustomer?.customerName ?? ""}
                className={fieldClassName}
                placeholder="Residencial Andalucia"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel htmlFor="community_id" required>
                Linked community
              </FieldLabel>
              <div className="relative">
                <select
                  id="community_id"
                  name="community_id"
                  required
                  defaultValue={defaultCommunityId}
                  className={cn(fieldClassName, "appearance-none pr-10")}
                >
                  <option value="" className="bg-[#18181b] text-slate-100">
                    Select community
                  </option>
                  {communities.map((community) => (
                    <option
                      key={community.id}
                      value={community.id}
                      className="bg-[#18181b] text-slate-100"
                    >
                      {community.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--console-text-muted)]" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel htmlFor="status" required>
                  Status
                </FieldLabel>
                <div className="relative">
                  <select
                    id="status"
                    name="status"
                    required
                    defaultValue={initialCustomer?.status ?? "active"}
                    className={cn(fieldClassName, "appearance-none pr-10")}
                  >
                    <option value="active" className="bg-[#18181b] text-slate-100">
                      Active
                    </option>
                    <option value="inactive" className="bg-[#18181b] text-slate-100">
                      Inactive
                    </option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--console-text-muted)]" />
                </div>
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="contract_date">Contract date</FieldLabel>
                <InputWithIcon icon={<CalendarDays className="h-4 w-4 stroke-[1.75]" />}>
                  <input
                    id="contract_date"
                    name="contract_date"
                    type="date"
                    defaultValue={initialCustomer?.contractDate ?? ""}
                    className={cn(fieldClassName, "pl-9")}
                  />
                </InputWithIcon>
              </div>
            </div>
          </div>
        </section>

        <section className={sectionClassName}>
          <SectionHeading
            icon={<UserRound className="h-4 w-4 stroke-[1.75]" />}
            title="Primary contact"
          />

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <FieldLabel htmlFor="primary_contact_name" required>
                Full name
              </FieldLabel>
              <input
                id="primary_contact_name"
                name="primary_contact_name"
                required
                defaultValue={primaryContact?.name ?? ""}
                className={fieldClassName}
                placeholder="Don Mario"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel htmlFor="primary_contact_phone">Phone / WhatsApp</FieldLabel>
              <InputWithIcon icon={<Phone className="h-4 w-4 stroke-[1.75]" />}>
                <input
                  id="primary_contact_phone"
                  name="primary_contact_phone"
                  defaultValue={primaryContact?.phone ?? ""}
                  className={cn(fieldClassName, "pl-9")}
                  placeholder="+504 9999-9999"
                />
              </InputWithIcon>
            </div>

            <div className="space-y-1.5">
              <FieldLabel htmlFor="primary_contact_email">Email</FieldLabel>
              <InputWithIcon icon={<Mail className="h-4 w-4 stroke-[1.75]" />}>
                <input
                  id="primary_contact_email"
                  name="primary_contact_email"
                  type="email"
                  defaultValue={primaryContact?.email ?? ""}
                  className={cn(fieldClassName, "pl-9")}
                  placeholder="donmario@email.com"
                />
              </InputWithIcon>
            </div>
          </div>

          <div className="mt-5 border-t border-[var(--console-border)] pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">Additional contacts</h3>
              <button
                type="button"
                onClick={addAdditionalContact}
                className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-[var(--console-border)] bg-white/[0.025] px-3 text-xs font-semibold text-slate-100 transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50"
              >
                <Plus className="h-4 w-4 stroke-[1.75]" />
                Add another contact
              </button>
            </div>

            {additionalContacts.length > 0 ? (
              <div className="mt-4 space-y-3">
                {additionalContacts.map((contact, index) => (
                  <div
                    key={contact.key}
                    className="rounded-md border border-[var(--console-border)] bg-[var(--console-surface-raised)] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">
                        Contact {index + 2}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeAdditionalContact(contact.key)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-400/20 bg-rose-500/[0.08] text-rose-200 transition-colors hover:bg-rose-500/15"
                        aria-label={`Remove contact ${index + 2}`}
                      >
                        <Trash2 className="h-4 w-4 stroke-[1.75]" />
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-4">
                      <div className="space-y-1.5">
                        <FieldLabel htmlFor={`additional-name-${contact.key}`}>
                          Full name
                        </FieldLabel>
                        <input
                          id={`additional-name-${contact.key}`}
                          value={contact.name}
                          onChange={(event) =>
                            updateAdditionalContact(
                              contact.key,
                              "name",
                              event.target.value,
                            )
                          }
                          className={fieldClassName}
                          placeholder="Don Eugenio"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <FieldLabel htmlFor={`additional-phone-${contact.key}`}>
                          Phone / WhatsApp
                        </FieldLabel>
                        <input
                          id={`additional-phone-${contact.key}`}
                          value={contact.phone}
                          onChange={(event) =>
                            updateAdditionalContact(
                              contact.key,
                              "phone",
                              event.target.value,
                            )
                          }
                          className={fieldClassName}
                          placeholder="+504 9888-8888"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <FieldLabel htmlFor={`additional-email-${contact.key}`}>
                          Email
                        </FieldLabel>
                        <input
                          id={`additional-email-${contact.key}`}
                          type="email"
                          value={contact.email}
                          onChange={(event) =>
                            updateAdditionalContact(
                              contact.key,
                              "email",
                              event.target.value,
                            )
                          }
                          className={fieldClassName}
                          placeholder="doneugenio@email.com"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <FieldLabel htmlFor={`additional-role-${contact.key}`}>
                          Role / title
                        </FieldLabel>
                        <input
                          id={`additional-role-${contact.key}`}
                          list="customer-contact-roles"
                          value={contact.role}
                          onChange={(event) =>
                            updateAdditionalContact(
                              contact.key,
                              "role",
                              event.target.value,
                            )
                          }
                          className={fieldClassName}
                          placeholder="Treasurer"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-md border border-dashed border-[var(--console-border)] bg-white/[0.015] px-4 py-4 text-sm text-[var(--console-text-muted)]">
                No additional contacts added.
              </p>
            )}
          </div>
        </section>

        <section className={sectionClassName}>
          <SectionHeading
            icon={<Mail className="h-4 w-4 stroke-[1.75]" />}
            title="Billing"
          />

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <FieldLabel htmlFor="billing_contact_name">Billing contact name</FieldLabel>
              <input
                id="billing_contact_name"
                name="billing_contact_name"
                defaultValue={initialCustomer?.billingContactName ?? ""}
                className={fieldClassName}
                placeholder="Don Mario"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel htmlFor="billing_email">Billing email</FieldLabel>
              <input
                id="billing_email"
                name="billing_email"
                type="email"
                defaultValue={initialCustomer?.billingEmail ?? ""}
                className={fieldClassName}
                placeholder="invoices@andalucia.hn"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel htmlFor="billing_preferred_channel">
                Preferred channel
              </FieldLabel>
              <div className="relative">
                <select
                  id="billing_preferred_channel"
                  name="billing_preferred_channel"
                  defaultValue={initialCustomer?.billingPreferredChannel ?? "email"}
                  className={cn(fieldClassName, "appearance-none pr-10")}
                >
                  <option value="" className="bg-[#18181b] text-slate-100">
                    Not set
                  </option>
                  <option value="email" className="bg-[#18181b] text-slate-100">
                    Email
                  </option>
                  <option value="whatsapp" className="bg-[#18181b] text-slate-100">
                    WhatsApp
                  </option>
                  <option value="other" className="bg-[#18181b] text-slate-100">
                    Other
                  </option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--console-text-muted)]" />
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <FieldLabel htmlFor="billing_notes">Billing notes</FieldLabel>
            <textarea
              id="billing_notes"
              name="billing_notes"
              defaultValue={initialCustomer?.billingNotes ?? ""}
              className={textareaClassName}
              placeholder="Send monthly invoice to Don Mario at this email."
            />
          </div>
        </section>

        <section className={sectionClassName}>
          <SectionHeading
            icon={<UserRound className="h-4 w-4 stroke-[1.75]" />}
            title="Legal information"
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel htmlFor="legal_name">Legal / business name</FieldLabel>
              <input
                id="legal_name"
                name="legal_name"
                defaultValue={initialCustomer?.legalName ?? ""}
                className={fieldClassName}
                placeholder="Residencial Andalucia"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel htmlFor="tax_id">RTN / Tax ID</FieldLabel>
              <input
                id="tax_id"
                name="tax_id"
                defaultValue={initialCustomer?.taxId ?? ""}
                className={fieldClassName}
                placeholder="08019012345678"
              />
            </div>
          </div>
        </section>

        <section className={sectionClassName}>
          <SectionHeading
            icon={<UserRound className="h-4 w-4 stroke-[1.75]" />}
            title="Internal notes"
          />

          <div className="mt-5 space-y-1.5">
            <FieldLabel htmlFor="internal_notes">Internal notes</FieldLabel>
            <textarea
              id="internal_notes"
              name="internal_notes"
              defaultValue={initialCustomer?.internalNotes ?? ""}
              className={textareaClassName}
              placeholder="Main communication happens through WhatsApp group."
            />
            <p className="text-xs text-[var(--console-text-muted)]">
              Internal use only.
            </p>
          </div>
        </section>
      </div>

      <aside className="space-y-5">
        <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-5">
          <h2 className="text-lg font-semibold text-white">Preview</h2>
          <div className="mt-4 divide-y divide-[var(--console-border)] text-sm">
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-[var(--console-text-muted)]">Mode</span>
              <span className="font-medium text-white">
                {isEditing ? "Edit profile" : "New customer"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-[var(--console-text-muted)]">Communities</span>
              <span className="font-medium text-white">{communities.length}</span>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-[var(--console-text-muted)]">Contacts</span>
              <span className="font-medium text-white">
                {additionalContacts.length + 1}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-5">
          <h2 className="text-lg font-semibold text-white">Actions</h2>
          <div className="mt-4 space-y-3">
            <SubmitButton label={isEditing ? "Save changes" : "Save customer"} />
            <Link
              href={
                initialCustomer
                  ? `/products/entry/customers/${initialCustomer.id}`
                  : "/products/entry/customers"
              }
              className="inline-flex h-9 w-full items-center justify-center rounded-md border border-[var(--console-border)] bg-white/[0.025] px-4 text-xs font-semibold text-slate-100 transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50"
            >
              Cancel
            </Link>
          </div>

          {state.message ? (
            <p className="mt-4 rounded-md border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
              {state.message}
            </p>
          ) : null}
        </section>
      </aside>

      <datalist id="customer-contact-roles">
        <option value="Administrator" />
        <option value="Treasurer" />
        <option value="Board Member" />
        <option value="Operations Contact" />
        <option value="Secondary Contact" />
      </datalist>
    </form>
  );
}
