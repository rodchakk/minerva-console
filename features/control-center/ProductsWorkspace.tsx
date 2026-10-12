"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BrainCircuit, ChevronRight, Plus, Search, X } from "lucide-react";
import { listedProductModules, type ProductModule, type ProductStatus } from "./productRegistry";

function statusTone(status: ProductStatus) {
  if (status === "operational") return "operational";
  if (status === "development") return "development";
  if (status === "error" || status === "disconnected") return "error";
  return "";
}

function kindLabel(product: ProductModule) {
  return product.kind === "native" ? "Native product" : "External product";
}

function ProductDetails({ product, onClose }: { product: ProductModule; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const Icon = product.icon;
  const openHref = product.availability === "available" ? product.href : null;
  return (
    <div className="minerva-drawer-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside className="minerva-drawer" role="dialog" aria-modal="true"
        aria-labelledby="minerva-product-detail-title">
        <header className="minerva-drawer-header">
          <div className="min-w-0">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[#A9A3B2]">Product details</p>
            <div className="flex min-w-0 items-center gap-3">
              <span className="minerva-product-icon !h-[42px] !w-[42px]"><Icon size={20} strokeWidth={1.75}/></span>
              <div className="min-w-0">
                <h2 id="minerva-product-detail-title" className="truncate text-[16px] font-semibold text-white">{product.name}</h2>
                <p className="mt-1 text-[11px] text-[#A9A3B2]">{kindLabel(product)}</p>
              </div>
            </div>
          </div>
          <button ref={closeButton} className="minerva-drawer-close" type="button" aria-label="Close product details" onClick={onClose}>
            <X size={17}/>
          </button>
        </header>

        <div className="minerva-drawer-body">
          <section className="minerva-drawer-section">
            <h3>Current state</h3>
            <span className={"minerva-status " + statusTone(product.status)}>{product.statusLabel}</span>
            <p className="mt-4 text-[12px] leading-5 text-[#C5BECE]">{product.description}</p>
          </section>
          <section className="minerva-drawer-section">
            <h3>Product</h3>
            <dl>
              <div className="minerva-detail-row"><dt>Owner</dt><dd>{product.owner}</dd></div>
              <div className="minerva-detail-row"><dt>Type</dt><dd>{kindLabel(product)}</dd></div>
              <div className="minerva-detail-row"><dt>Environment</dt><dd className="capitalize">{product.environment}</dd></div>
              <div className="minerva-detail-row"><dt>Connection</dt><dd>{product.connectionMode.replaceAll("_", " ")}</dd></div>
              <div className="minerva-detail-row"><dt>Availability</dt><dd>{product.availability.replaceAll("_", " ")}</dd></div>
            </dl>
          </section>
          <section className="minerva-drawer-section">
            <h3>Administration</h3>
            <p className="text-[12px] leading-5 text-[#C5BECE]">
              {openHref
                ? "Open this product's existing administration workspace."
                : "This product is not currently available to open from this workspace."}
            </p>
          </section>
        </div>
        <footer className="minerva-drawer-footer">
          <button type="button" className="minerva-mechanical secondary" onClick={onClose}>Close</button>
          {openHref ? (
            <Link href={openHref} className="minerva-mechanical primary">
              Open administration <ArrowUpRight size={15}/>
            </Link>
          ) : (
            <span className="minerva-mechanical secondary" aria-disabled="true">Unavailable</span>
          )}
        </footer>
      </aside>
    </div>
  );
}

export function ProductsWorkspace() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [kind, setKind] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = listedProductModules.find((product) => product.id === selectedId) ?? null;

  const filtered = listedProductModules.filter((product) => {
    const matchesQuery = (product.name + " " + product.description + " " + product.slug)
      .toLowerCase().includes(search.trim().toLowerCase());
    return matchesQuery && (status === "all" || product.status === status)
      && (kind === "all" || product.kind === kind);
  });

  return (
    <div className="minerva-content">
      <div className="minerva-crumb">
        <span>Minerva Console</span><ChevronRight size={12}/><strong>Products</strong>
      </div>
      <header>
        <h1 className="minerva-heading">Products</h1>
        <p className="minerva-subtitle">Manage Minerva products, modules and internal tools.</p>
      </header>
      <div className="minerva-toolbar">
        <label className="minerva-search-wrap">
          <Search aria-hidden="true"/>
          <span className="sr-only">Search products</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)}
            className="minerva-input" placeholder="Search products..." aria-label="Search products"/>
        </label>
        <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)} className="minerva-select">
          <option value="all">All statuses</option>
          <option value="operational">Operational</option>
          <option value="development">Development</option>
          <option value="disconnected">Disconnected</option>
          <option value="locked">Locked</option>
          <option value="error">Error</option>
        </select>
        <select aria-label="Filter by type" value={kind} onChange={(event) => setKind(event.target.value)} className="minerva-select">
          <option value="all">All types</option>
          <option value="native">Native</option>
          <option value="external">External</option>
        </select>
        <Link href="/products/add" className="minerva-mechanical primary minerva-toolbar-add">
          <Plus size={15}/> Add product
        </Link>
      </div>

      <section className="minerva-list-frame" aria-label="Registered products">
        <div className="minerva-list-scroll">
          <table className="minerva-product-table">
            <thead><tr>
              <th scope="col" className="w-[47%]">Name</th>
              <th scope="col" className="w-[20%]">Type</th>
              <th scope="col" className="w-[18%]">Status</th>
              <th scope="col" className="w-[12%]">Environment</th>
              <th scope="col" className="w-[3%]"><span className="sr-only">Details</span></th>
            </tr></thead>
            <tbody>
              {filtered.map((product) => {
                const Icon = product.icon;
                return (
                  <tr key={product.id} className={selectedId === product.id ? "is-selected" : undefined}>
                    <td>
                      <div className="minerva-product-name">
                        <span className="minerva-product-icon"><Icon size={18} strokeWidth={1.75}/></span>
                        <button type="button" onClick={() => setSelectedId(product.id)}
                          className="minerva-product-open min-w-0" aria-label={"View details for " + product.name}>
                          <strong>{product.name}</strong>
                          <small>{product.description}</small>
                        </button>
                      </div>
                    </td>
                    <td>{kindLabel(product)}</td>
                    <td><span className={"minerva-status " + statusTone(product.status)}>{product.statusLabel}</span></td>
                    <td className="capitalize">{product.environment}</td>
                    <td>
                      <button type="button" className="minerva-table-arrow" onClick={() => setSelectedId(product.id)}
                        aria-label={"Open " + product.name + " details"}><ChevronRight size={17}/></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? (
          <div className="border-t border-[#141119] px-5 py-10 text-center text-[12px] text-[#A9A3B2]">No products match your filters.</div>
        ) : null}
      </section>
      <div className="minerva-list-meta">
        <span>{filtered.length} of {listedProductModules.length} registered products</span>
        <span>Live product registry · No simulated metrics</span>
      </div>
      <section aria-label="Internal tools">
        <h2 className="minerva-tools-title">INTERNAL TOOLS</h2>
        <Link className="minerva-tool-link" href="/brain">
          <span className="flex items-center gap-3">
            <span className="minerva-product-icon !h-[31px] !w-[31px]"><BrainCircuit size={16}/></span>
            <span>
              <strong>Minerva Core Brain</strong>
              <small>Internal knowledge and operational context</small>
            </span>
          </span>
          <ArrowRight size={16} className="text-[#958A9F]"/>
        </Link>
      </section>

      {selected ? <ProductDetails product={selected} onClose={() => setSelectedId(null)} /> : null}
    </div>
  );
}
