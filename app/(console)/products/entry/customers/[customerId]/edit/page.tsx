import { notFound } from "next/navigation";
import { CustomerForm } from "@/features/entry/customers/CustomerForm";
import {
  getCustomerProfile,
  listCustomerCommunityOptions,
} from "@/features/entry/customers/queries";

export default async function EditCustomerPage(
  props: {
    params: Promise<{ customerId: string }>;
  },
) {
  const { customerId } = await props.params;
  const [customer, communities] = await Promise.all([
    getCustomerProfile(customerId),
    listCustomerCommunityOptions(),
  ]);

  if (!customer) {
    notFound();
  }

  return (
    <div className="space-y-5">
      <section className="px-0.5 pt-5">
        <div className="min-w-0 max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">
            ENTRY · Customers
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white lg:text-[2.05rem]">
            Edit customer
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
            Update contacts, billing, legal information, status, and internal notes for {customer.customerName}.
          </p>
        </div>
      </section>

      <CustomerForm communities={communities} initialCustomer={customer} />
    </div>
  );
}
