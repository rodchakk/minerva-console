import Link from "next/link";
import { ArrowUpRight, Lock, Plus } from "lucide-react";
import { productModules } from "@/features/control-center/productRegistry";
import { cn } from "@/lib/supabase/utils";

function statusClass(status: string) {
  if (status === "operational") {
    return "border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-200";
  }

  if (status === "development") {
    return "border-amber-400/20 bg-amber-500/[0.08] text-amber-200";
  }

  if (status === "locked") {
    return "border-white/[0.12] bg-white/[0.04] text-slate-300";
  }

  return "border-[#ff4d4d]/25 bg-[#ff4d4d]/10 text-red-200";
}

export default function ProductsPage() {
  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-4 px-0.5 pt-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-normal text-white lg:text-[2rem]">
            Products
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--console-text-muted)]">
            Product modules registered with Minerva Console. ENTRY is active;
            Seshat and restricted modules are represented without fake surfaces.
          </p>
        </div>
        <Link
          href="/products/add"
          className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-md border border-white/[0.12] bg-white/[0.045] px-3.5 text-sm font-semibold text-white transition-colors hover:border-[#ff4d4d]/40 hover:bg-white/[0.07]"
        >
          <Plus className="h-4 w-4 text-[#ff4d4d] stroke-[1.75]" />
          Add Product
        </Link>
      </section>

      <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {productModules.map((product) => {
          const Icon = product.icon;
          const content = (
            <article
              className={cn(
                "flex h-full min-h-[220px] flex-col rounded-lg border border-white/[0.10] bg-[#181a1d] p-5",
                product.href && product.availability === "available"
                  ? "transition-colors hover:border-white/[0.18]"
                  : "",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/[0.10] bg-white/[0.04] text-slate-200">
                    <Icon className="h-5 w-5 stroke-[1.75]" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-white">
                      {product.name}
                    </h2>
                    <p className="mt-0.5 text-xs capitalize text-[var(--console-text-muted)]">
                      {product.kind} · {product.connectionMode.replaceAll("_", " ")}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 rounded-md border px-2 py-1 text-xs font-medium",
                    statusClass(product.status),
                  )}
                >
                  {product.statusLabel}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--console-text-muted)]">
                {product.description}
              </p>
              <dl className="mt-auto grid grid-cols-3 divide-x divide-white/[0.10] pt-5">
                {product.metrics.map((metric) => (
                  <div key={metric.label} className="px-3 first:pl-0 last:pr-0">
                    <dt className="truncate text-[11px] text-[var(--console-text-muted)]">
                      {metric.label}
                    </dt>
                    <dd className="mt-1 truncate text-sm font-semibold text-white">
                      {metric.value}
                    </dd>
                  </div>
                ))}
              </dl>
              {product.href && product.availability === "available" ? (
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
                  Open module
                  <ArrowUpRight className="h-4 w-4 stroke-[1.75]" />
                </span>
              ) : product.availability === "restricted" ? (
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--console-text-soft)]">
                  <Lock className="h-4 w-4 stroke-[1.75]" />
                  Restricted
                </span>
              ) : null}
            </article>
          );

          if (product.href && product.availability === "available") {
            return (
              <Link key={product.id} href={product.href}>
                {content}
              </Link>
            );
          }

          return <div key={product.id}>{content}</div>;
        })}
      </section>
    </div>
  );
}
