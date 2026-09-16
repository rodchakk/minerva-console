import { CustomerForm } from "@/features/entry/customers/CustomerForm";
import { listCustomerCommunityOptions } from "@/features/entry/customers/queries";

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function NewCustomerPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const communities = await listCustomerCommunityOptions();
  const initialCommunityId = getSingleParam(searchParams.community_id);

  return (
    <div className="space-y-5">
      <section className="px-0.5 pt-5">
        <div className="min-w-0 max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ff8b8b]">
            Minerva · Customers
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white lg:text-[2.05rem]">
            New customer
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
            Add a customer manually to Minerva's internal directory. ENTRY community linking remains a product relationship, not the customer's owner.
          </p>
        </div>
      </section>

      <CustomerForm communities={communities} initialCommunityId={initialCommunityId} />
    </div>
  );
}
