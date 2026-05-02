import { MetricCard } from "@/components/cards/MetricCard";
import { StatusCard } from "@/components/cards/StatusCard";
import { PageHeader } from "@/components/layout/PageHeader";

const metrics = [
  {
    label: "Total users",
    value: "Placeholder",
    hint: "Ready for real Supabase aggregation once the global metrics layer is connected.",
    status: "Pending",
    tone: "warning" as const,
  },
  {
    label: "Total communities",
    value: "Placeholder",
    hint: "ENTRY onboarding data can be connected here without changing the dashboard structure.",
    status: "Pending",
    tone: "warning" as const,
  },
  {
    label: "Registered records / events",
    value: "Placeholder",
    hint: "Designed for cross-product event totals, not ENTRY door activity feeds.",
    status: "Pending",
    tone: "warning" as const,
  },
  {
    label: "Active products",
    value: "1 live",
    hint: "ENTRY is currently the first connected product area in the console.",
    status: "Live",
    tone: "success" as const,
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Global dashboard"
        description="High-level operational view for Minerva Technologies. This dashboard is intentionally product-agnostic and ready to scale beyond ENTRY."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <StatusCard
          title="System health"
          tone="success"
          description="Console shell, auth boundary, and protected navigation are active. Connect live checks here as backend health endpoints become available."
        />
        <StatusCard
          title="Important alerts"
          tone="warning"
          description="No live alert feed connected yet. This card is structured for future cross-product incidents, onboarding blockers, or finance exceptions."
        />
        <StatusCard
          title="Scalability note"
          tone="info"
          description="Sidebar, products section, and placeholder modules are organized to absorb more Minerva products without redesigning the app shell."
        />
      </section>
    </div>
  );
}
