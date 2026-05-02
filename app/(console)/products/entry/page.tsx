import Link from "next/link";
import { MetricCard } from "@/components/cards/MetricCard";
import { ProductCard } from "@/components/cards/ProductCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";

export default function EntryPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="ENTRY"
        description="Product-level command center for the current ENTRY integration. Use this area for communities, user administration, and product settings."
        actions={
          <Link href="/products/entry/communities/new">
            <Button>Create community</Button>
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Communities"
          value="Live data"
          hint="Connected to the production-ready communities RPC."
          status="Connected"
          tone="success"
        />
        <MetricCard
          label="Users"
          value="Search ready"
          hint="User search is available through the existing admin RPC."
          status="Connected"
          tone="success"
        />
        <MetricCard
          label="Feature health"
          value="Placeholder"
          hint="Designed for per-feature health rollups as instrumentation is added."
          status="Pending"
          tone="warning"
        />
        <MetricCard
          label="Alerts"
          value="Placeholder"
          hint="Reserved for product incidents, sync issues, or onboarding blockers."
          status="Pending"
          tone="warning"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ProductCard
          title="Communities"
          description="Review current communities, feature flags, activation status, and onboarding counts."
          href="/products/entry/communities"
          status="Live"
        />
        <ProductCard
          title="Users"
          description="Search user records and prepare future admin workflows like password recovery."
          href="/products/entry/users"
          status="Live"
        />
        <ProductCard
          title="Settings"
          description="Reserved for product-level ENTRY configuration and guardrails."
          href="/products/entry/settings"
          status="Placeholder"
        />
      </section>
    </div>
  );
}
