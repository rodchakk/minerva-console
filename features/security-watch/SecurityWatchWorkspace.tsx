"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BellRing, ClipboardCopy, DatabaseZap, Radar, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  formatDiagnosis, monitoredProducts, productCatalog,
  type SecurityFinding, type StoredScan
} from "./model";
import styles from "./SecurityWatchWorkspace.module.css";

type RunSummary = { runId: string; checkedAt: string; status: string; findings: number };
type Props = { state: StoredScan | null; error: string | null; recent: RunSummary[] };
type Filter = "all" | "priority" | "review";
const severe = (f: SecurityFinding) => f.severity === "CRITICAL" || f.severity === "HIGH";
const formatDate = (value: string) => {
  try {
    return new Date(value).toLocaleString("en-US", {
      timeZone: "America/Tegucigalpa",
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
  } catch { return "Unknown"; }
};

function severityLabel(finding: SecurityFinding) {
  if (severe(finding)) return { label: finding.severity, tone: styles.urgent };
  if (finding.confidence === "KEYWORD_ONLY") return { label: "VERIFY SCOPE", tone: styles.watch };
  return { label: "REVIEW", tone: styles.review };
}

function StatusChip({ state, error }: Pick<Props, "state" | "error">) {
  if (error) return <span className={styles.statusWarn}>STORAGE UNAVAILABLE</span>;
  if (!state) return <span className={styles.statusWarn}>SETUP PENDING</span>;
  if (state.status === "failed") return <span className={styles.statusWarn}>ALL SOURCES FAILED</span>;
  if (state.status === "partial") return <span className={styles.statusWarn}>PARTIAL COVERAGE</span>;
  const last = Date.parse(state.checkedAt);
  if (!Number.isFinite(last) || Date.now() - last > 36 * 3600000) {
    return <span className={styles.statusWarn}>MONITORING OVERDUE</span>;
  }
  return <span className={styles.statusOk}><span className={styles.dot}/> AUTOMATIC MONITORING · EVERY 12H</span>;
}

export function SecurityWatchWorkspace({ state, error, recent }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const findings = state?.findings || [];
  const visible = useMemo(() => findings.filter((f) => {
    if (filter === "priority") return severe(f);
    if (filter === "review") return !severe(f);
    return true;
  }), [findings, filter]);
  const urgent = findings.filter(severe).length;
  const review = findings.length - urgent;

  async function copyReport(items: SecurityFinding[], id: string) {
    const report = formatDiagnosis(items, state);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(report);
      setCopied(id);
      setCopyFallback(null);
    } catch {
      setCopyFallback(report);
      setCopied(null);
    }
  }

  return (
    <div className={styles.workspace}>
      <div className={styles.kicker}>
        <span>MINERVA CONSOLE / OBSERVABILITY / SECURITY WATCH</span>
        <span className={styles.muted}>MINERVA TECHNOLOGIES / INTERNAL OPERATIONS</span>
      </div>

      <div className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>SYSTEM INTELLIGENCE / 002</p>
          <h1>Security <em>Watch.</em></h1>
          <p>Public vulnerability advisories related to our registered technology stack.
            <strong> No access to product code or infrastructure.</strong></p>
        </div>
        <StatusChip state={state} error={error} />
      </div>

      <div className={styles.stats}>
        <section className={styles.metric}>
          <span>MONITORED PRODUCTS</span><strong>{String(monitoredProducts.length).padStart(2, "0")}<small>/{String(productCatalog.length).padStart(2, "0")}</small></strong>
          <p>{productCatalog.length - monitoredProducts.length} awaiting setup</p>
        </section>
        <section className={styles.metric}>
          <span>HIGH PRIORITY MATCHES</span><strong className={styles.accent}>{String(urgent).padStart(2, "0")}</strong>
          <p>Potential exposure — verify</p>
        </section>
        <section className={styles.metric}>
          <span>NEEDS REVIEW</span><strong>{String(review).padStart(2, "0")}</strong>
          <p>Version or scope confirmation required</p>
        </section>
        <section className={styles.metric}>
          <span>LAST AUTOMATIC CHECK</span><strong className={styles.metricTime}>{state ? formatDate(state.checkedAt) : "Not yet"}</strong>
          <p>{state ? state.status.toUpperCase() + " · Honduras time" : "Scheduled near 06:17 and 18:17"}</p>
        </section>
      </div>

      <section className={styles.copyStrip} aria-label="Diagnosis handoff">
        <div className={styles.copyText}>
          <span className={styles.copyIcon}><ClipboardCopy size={21}/></span>
          <div>
            <h2>Technical diagnosis ready for your AI</h2>
            <p>You only need to see what happened, who owns it, and copy the report.</p>
            <span>{findings.length} tracked advisory matches · No automatic patches or production changes</span>
          </div>
        </div>
        <button className={styles.mainButton} type="button" onClick={() => copyReport(findings, "all")}>
          <ClipboardCopy size={15} /> {copied === "all" ? "Copied!" : "Copy full diagnosis"}
        </button>
      </section>

      <div className={styles.sectionHead}>
        <span>PUBLIC SECURITY ADVISORIES</span>
        <span>{state ? "LAST SCAN: " + formatDate(state.checkedAt) : "NO LIVE SCAN YET"}</span>
      </div>
      <section className={styles.panel} aria-label="Advisory inbox">
        <div className={styles.panelHead}>
          <div><h2>Advisory inbox</h2><p>Potential matches, responsible software and team, and next steps.</p></div>
          <span className={styles.counter}>{findings.length} FINDINGS</span>
        </div>
        <div className={styles.toolbar}>
          <div className={styles.filters}>
            {([
              ["all", "All advisories"],
              ["priority", "High priority"],
              ["review", "Needs review"]
            ] as [Filter, string][]).map(([key, label]) => (
              <button key={key} type="button" aria-pressed={filter === key}
                className={filter === key ? styles.selectedFilter : styles.filterButton}
                onClick={() => setFilter(key)}>{label}</button>
            ))}
          </div>
          <span className={styles.disclaimer}>MATCH ≠ CONFIRMED EXPOSURE</span>
        </div>

        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr><th>Priority</th><th>Security notice</th><th>Technology</th>
                <th>Software to review</th><th>Responsible team</th><th>Next action</th><th>Diagnosis</th></tr>
            </thead>
            <tbody>
              {visible.map((finding) => {
                const label = severityLabel(finding);
                return (
                  <tr key={finding.key}>
                    <td><span className={label.tone}>{label.label}</span></td>
                    <td className={styles.noticeCell}>
                      <strong>{finding.title}</strong>
                      <p>{finding.summary}</p>
                      <small>{finding.advisoryId} · {finding.source.toUpperCase()} · {finding.publishedAt ? formatDate(finding.publishedAt) : "Publication unknown"}</small>
                    </td>
                    <td className={styles.technology}>{finding.technology}<small>{finding.version}</small></td>
                    <td><div className={styles.pills}>{finding.products.map((p) => <span key={p.id}>{p.name}</span>)}</div></td>
                    <td><div className={styles.team}>{[...new Set(finding.products.map((p) => p.team))].join(" / ")}</div></td>
                    <td className={styles.nextAction}>{finding.confidence === "KEYWORD_ONLY" ? "Verify vendor and scope" : "Verify deployed version"}<small>{finding.nextStep}</small></td>
                    <td><button type="button" className={styles.rowButton}
                      onClick={() => copyReport([finding], finding.key)}>
                      {copied === finding.key ? "Copied!" : "Copy finding"}
                    </button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visible.length && (
            <div className={styles.empty}>
              {error ? "The radar is unavailable. Do not interpret this as an all-clear." :
                !state ? "Awaiting the first scheduled scan. No simulated vulnerabilities are displayed." :
                  state.status === "failed" ? "Advisory providers failed. Last known results remain available when possible." :
                    "No matching advisories in this view. This is not a security certification."}
            </div>
          )}
        </div>
        <div className={styles.panelFoot}>
          <span>{String(visible.length).padStart(2, "0")} SHOWN / {String(findings.length).padStart(2, "0")} TRACKED</span>
          <span>Automated sources: OSV + NVD · Version and keyword matching</span>
        </div>
      </section>

      <div className={styles.sectionHead} id="sw-catalog">
        <span>REGISTERED PRODUCTS & OWNERSHIP</span><span>MANUALLY MAINTAINED CATALOG</span>
      </div>
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div><h2>Products under watch</h2><p>Technology profiles only; no live access to products or repositories.</p></div>
          <span className={styles.counter}>{productCatalog.length} PRODUCTS</span>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.catalogTable}>
            <thead><tr><th>Product</th><th>Registered technology / version</th><th>Responsible team</th><th>Monitoring</th></tr></thead>
            <tbody>{productCatalog.map((product) => (
              <tr key={product.id}>
                <td><strong>{product.name}</strong><small>{product.environment}</small></td>
                <td><div className={styles.pills}>{product.technologies.length
                  ? product.technologies.map((tech) => <span key={tech.id}>{tech.name} {tech.version}</span>)
                  : <span>Profile not submitted</span>}</div></td>
                <td className={styles.team}>{product.team}</td>
                <td><span className={product.enabled ? styles.active : styles.pending}>
                  {product.enabled ? "IN CATALOG" : "AWAITING SETUP"}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <div className={styles.bottomGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHead}><div><h2>Automatic activity</h2><p>Latest scheduled scans, including partial failures.</p></div><Radar size={18} color="#ed6675"/></div>
          <div className={styles.recent}>
            {!recent.length && <p>No completed scans recorded.</p>}
            {recent.map((run) => <div key={run.runId}>
              <span className={run.status === "ok" ? styles.runDot : styles.runWarning}/>
              <span>{formatDate(run.checkedAt)}</span>
              <strong>{run.status === "ok" ? "Checked public sources" : "Coverage " + run.status}</strong>
              <small>{run.findings} saved matches</small>
            </div>)}
          </div>
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHead}><div><h2>What you need to do</h2><p>One simple, notification-driven workflow.</p></div><ShieldCheck size={18} color="#ed6675"/></div>
          <div className={styles.instructions}>
            <p><BellRing size={16}/> <strong>01 / Receive a notification.</strong> Only new high-priority matches trigger email.</p>
            <p><ShieldAlert size={16}/> <strong>02 / See the product and owner.</strong> Check the advisory table above.</p>
            <p><DatabaseZap size={16}/> <strong>03 / Copy diagnosis to your AI.</strong> The product team verifies and handles fixes.</p>
            {state?.notification === "not_configured" && <p className={styles.warningText}>Email notification is not configured yet.</p>}
            {state?.notification === "failed" && <p className={styles.warningText}>Latest email notification failed. Check sender setup.</p>}
            {(state?.status === "partial" || state?.status === "failed") &&
              <p className={styles.warningText}>One or more advisory feeds failed; results may be incomplete.</p>}
          </div>
        </section>
      </div>

      {copyFallback && <section className={styles.fallback} aria-label="Copy diagnosis manually">
        <h2>Clipboard blocked by your browser</h2>
        <p>Select and copy this report instead.</p>
        <textarea readOnly aria-label="Full diagnosis report" value={copyFallback}/>
        <button type="button" onClick={() => setCopyFallback(null)}>Close</button>
      </section>}

      <footer className={styles.footer}>
        <span>MINERVA TECHNOLOGIES × THE UNKNOWN IS ENGINEERED HERE // 002</span>
        <span><Link href="/products">PRODUCT REGISTRY</Link> · SECURITY WATCH / READ ONLY</span>
      </footer>
    </div>
  );
}
