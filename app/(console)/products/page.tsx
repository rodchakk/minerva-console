import { ProductCard } from "@/components/cards/ProductCard";
import { PageHeader } from "@/components/layout/PageHeader";

export default function ProductsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Products"
        description="Product spaces connected to Minerva Console. The global shell is ready for more products, but only ENTRY is wired today."
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <ProductCard
          title="ENTRY"
          description="Superadmin area for onboarding communities, searching users, and managing product-level settings for the existing ENTRY backend."
          href="/products/entry"
          status="Connected"
        />
      </section>
    </div>
  );
}
