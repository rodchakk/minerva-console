"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, Plus, Search, X } from "lucide-react";
import { listedProductModules, type ProductModule, type ProductStatus } from "./productRegistry";
import { HangarCraft } from "./HangarArt";

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
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[#A9A3B2]">SYSTEM PROFILE // MINERVA</p>
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
          <div className="mothership-drawer-craft" aria-hidden="true"><HangarCraft animate={false} /></div>
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
  const [ambientMotion, setAmbientMotion] = useState(true);
  const [contacted, setContacted] = useState(false);
  const selected = listedProductModules.find((product) => product.id === selectedId) ?? null;

  const filtered = listedProductModules.filter((product) => {
    const matchesQuery = (product.name + " " + product.description + " " + product.slug)
      .toLowerCase().includes(search.trim().toLowerCase());
    return matchesQuery && (status === "all" || product.status === status)
      && (kind === "all" || product.kind === kind);
  });

  return (
    <div className="minerva-content mothership-page">
      <div className="mothership-breadcrumb">
        <span>Minerva Console</span><ChevronRight size={12}/><span>Sector 001</span>
        <ChevronRight size={12}/><strong>Products</strong>
      </div>

      <header className="mothership-hero">
        <div className="mothership-hero-copy">
          <p className="mothership-overline">SYSTEM REGISTRY // CENTRAL NETWORK</p>
          <h1 className="mothership-title">The <em>Hangar.</em></h1>
          <p className="mothership-lede">
            A home for everything we build. Quietly connected, deliberately engineered,
            and ready for what comes next.
          </p>
          <div className="mothership-tags">
            <span className="mothership-tag">
              <span aria-hidden="true">◈</span>
              <strong>{String(listedProductModules.length).padStart(2, "0")}</strong>
              {listedProductModules.length === 1 ? " SYSTEM DOCKED" : " SYSTEMS DOCKED"}
            </span>
            <span className="mothership-tag verified"><span className="mothership-dot" />
              INTERNAL WORKSPACE
            </span>
          </div>
        </div>
        <div className="mothership-art-wrap">
          <HangarCraft animate={ambientMotion} contacted={contacted} onContact={() => setContacted(true)}/>
        </div>
      </header>

      <section aria-label="Registered Minerva products">
        <div className="mothership-section-line">
          <strong>DOCKED SYSTEMS <span>[ {String(listedProductModules.length).padStart(2, "0")} ]</span></strong>
          <span>MINERVA TECHNOLOGIES / PRODUCT REGISTRY</span>
        </div>
        <div className="minerva-toolbar">
          <label className="minerva-search-wrap">
            <Search aria-hidden="true"/>
            <span className="sr-only">Search products</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)}
              className="minerva-input" placeholder="Find a system..." aria-label="Search products"/>
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
            <Plus size={15}/> Register system
          </Link>
        </div>

        <div className="minerva-list-frame">
          <div className="minerva-list-scroll">
            <table className="minerva-product-table">
              <thead><tr>
                <th scope="col" className="w-[47%]">System</th>
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
            <div className="border-t border-[#141119] px-5 py-10 text-center text-[12px] text-[#A9A3B2]">
              No systems match your filters.
            </div>
          ) : null}
        </div>
        <div className="minerva-list-meta">
          <span>{String(filtered.length).padStart(2, "0")} / {String(listedProductModules.length).padStart(2, "0")} REGISTERED SYSTEMS</span>
          <span>CONNECTED TO ACTUAL MINERVA PRODUCT REGISTRY</span>
        </div>
      </section>

      <footer className="mothership-footer">
        <span>MINERVA TECHNOLOGIES <b>×</b> THE UNKNOWN IS ENGINEERED HERE <span className="opacity-60">// 001</span></span>
        <button type="button" className="mothership-motion-toggle" aria-pressed={ambientMotion}
          onClick={() => setAmbientMotion((on) => !on)}
          aria-label={ambientMotion ? "Pause ambient animation" : "Resume ambient animation"}>
          <span className="mothership-motion-track" aria-hidden="true"/>
          ATMOSPHERE {ambientMotion ? "ON" : "OFF"}
        </button>
      </footer>

      {contacted ? (
        <div className="mothership-contact" role="status">
          CONTACT ESTABLISHED · Welcome aboard, Earthling.
          <button type="button" aria-label="Dismiss greeting" onClick={() => setContacted(false)}>×</button>
        </div>
      ) : null}
      {selected ? <ProductDetails product={selected} onClose={() => setSelectedId(null)} /> : null}
    </div>
  );
}
