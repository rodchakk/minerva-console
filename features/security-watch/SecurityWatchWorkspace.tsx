"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BellRing, ClipboardCopy, DatabaseZap, Radar, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  formatDiagnosis, monitoredProducts, productCatalog,
  type SecurityFinding, type StoredScan
} from "./model";
import styles from "./SecurityWatchWorkspace.module.css";
import { hostedStorageAdvisoryStatus } from "@/scripts/security-watch-hosted-evidence.mjs";

type RunSummary = { runId: string; checkedAt: string; status: string; findings: number };
type Props = { state: StoredScan | null; error: string | null; recent: RunSummary[]; ingestConfigured: boolean; notificationsConfigured: boolean; overdue: boolean };
type Filter = "all" | "priority" | "review" | "verified";
const EMPTY_FINDINGS: SecurityFinding[] = [];
const severe = (f: SecurityFinding) => f.severity === "CRITICAL" || f.severity === "HIGH";
const formatDate = (value: string) => {
  try {
    return new Date(value).toLocaleString("en-US", {
      timeZone: "America/Tegucigalpa",
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
  } catch { return "Unknown"; }
};

function severityLabel(finding: SecurityFinding, patchStatus: string | null) {
  if (patchStatus === "verified") return { label: "PATCH VERIFIED", tone: styles.active };
  if (patchStatus === "recheck") return { label: "RECHECK PATCH", tone: styles.watch };
  if (severe(finding)) return { label: finding.severity, tone: styles.urgent };
  if (finding.confidence === "KEYWORD_ONLY") return { label: "VERIFY SCOPE", tone: styles.watch };
  if (finding.confidence === "VENDOR_NOTICE") return { label: "VENDOR NOTICE", tone: styles.watch };
  if (finding.confidence === "CPE_PRODUCT") return { label: "PRODUCT MATCH", tone: styles.review };
  return { label: "REVIEW", tone: styles.review };
}

function StatusChip({ state, error, ingestConfigured, overdue }: Pick<Props, "state" | "error" | "ingestConfigured" | "overdue">) {
  if (!ingestConfigured) return <span className={styles.statusWarn}>ACTIVATION PENDING</span>;
  if (error) return <span className={styles.statusWarn}>STORAGE UNAVAILABLE</span>;
  if (!state) return <span className={styles.statusWarn}>SETUP PENDING</span>;
  if (state.status === "failed") return <span className={styles.statusWarn}>ALL SOURCES FAILED</span>;
  if (state.status === "partial") return <span className={styles.statusWarn}>PARTIAL COVERAGE</span>;
  if (overdue) {
    return <span className={styles.statusWarn}>MONITORING OVERDUE</span>;
  }
  return <span className={styles.statusOk}><span className={styles.dot}/> AUTOMATIC MONITORING · EVERY 12H</span>;
}

export function SecurityWatchWorkspace({ state, error, recent, ingestConfigured, notificationsConfigured, overdue }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const findings = state?.findings ?? EMPTY_FINDINGS;
  const evidenceStatus = (f: SecurityFinding) => hostedStorageAdvisoryStatus(f, state?.checkedAt)?.status ?? null;
  const visible = useMemo(() => findings.filter((f) => {
    const patch = hostedStorageAdvisoryStatus(f, state?.checkedAt)?.status;
    if (filter === "priority") return !patch && severe(f);
    if (filter === "review") return patch === "recheck" || (!patch && !severe(f));
    if (filter === "verified") return patch === "verified";
    return true;
  }), [findings, filter, state?.checkedAt]);
  const urgent = findings.filter((f) => !evidenceStatus(f) && severe(f)).length;
  const review = findings.filter((f) => evidenceStatus(f) === "recheck" || (!evidenceStatus(f) && !severe(f))).length;
  const verified = findings.filter((f) => evidenceStatus(f) === "verified").length;
  const legacyCount = productCatalog.filter((product) => product.environment === "legacy" && !product.enabled).length;
  const awaitingCount = productCatalog.filter((product) => !product.enabled && product.environment !== "legacy").length;

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
        <StatusChip state={state} error={error} ingestConfigured={ingestConfigured} overdue={overdue} />
      </div>

      <div className={styles.stats}>
        <section className={styles.metric}>
          <span>MONITORED PRODUCTS</span><strong>{String(monitoredProducts.length).padStart(2, "0")}<small>/{String(productCatalog.length).padStart(2, "0")}</small></strong>
          <p>{legacyCount} legacy excluded · {awaitingCount} awaiting setup</p>
        </section>
        <section className={styles.metric}>
          <span>HIGH PRIORITY MATCHES</span><strong className={styles.accent}>{String(urgent).padStart(2, "0")}</strong>
          <p>Unverified high-severity matches only</p>
        </section>
        <section className={styles.metric}>
          <span>NEEDS REVIEW</span><strong>{String(review).padStart(2, "0")}</strong>
          <p>{verified} provider patches verified on hosted services</p>
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
            <span>{findings.length} public notices · {verified} verified hosted patches · Original severity and audit history retained</span>
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
          <div><h2>Advisory inbox</h2><p>Current advisories plus dated hosted patch evidence. Verified notices remain visible; unverified or new advisories are never silently suppressed.</p></div>
          <span className={styles.counter}>{findings.length} FINDINGS</span>
        </div>
        <div className={styles.toolbar}>
          <div className={styles.filters}>
            {([
              ["all", "All advisories"],
              ["priority", "High priority"],
              ["review", "Needs review"],
              ["verified", "Verified patches"]
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
                const evidence = hostedStorageAdvisoryStatus(finding, state?.checkedAt);
                const label = severityLabel(finding, evidence?.status ?? null);
                return (
                  <tr key={finding.key}>
                    <td><span className={label.tone}>{label.label}</span></td>
                    <td className={styles.noticeCell}>
                      <strong>{finding.title}</strong>
                      <p>{finding.summary}</p>
                      <small>{finding.advisoryId} · Original severity: {finding.severity} · {finding.source.toUpperCase()} · {finding.publishedAt ? formatDate(finding.publishedAt) : "Publication unknown"} · <a href={finding.url} target="_blank" rel="noopener noreferrer">Official source</a></small>
                    </td>
                    <td className={styles.technology}>{finding.technology}<small>{finding.version}</small></td>
                    <td><div className={styles.pills}>{finding.products.map((p) => <span key={p.id}>{p.name}</span>)}</div></td>
                    <td><div className={styles.team}>{[...new Set(finding.products.map((p) => p.team))].join(" / ")}</div></td>
                    <td className={styles.nextAction}>{evidence?.status === "verified" ? "Hosted patch verified" : evidence?.status === "recheck" ? "Reverify hosted Storage" : finding.confidence === "KEYWORD_ONLY" ? "Verify vendor and scope" : finding.confidence === "VENDOR_NOTICE" ? "Check provider patch status" : finding.confidence === "CPE_PRODUCT" ? "Verify affected version" : "Verify deployed version"}<small>{evidence ? `Storage ${evidence.installedVersion} checked ${evidence.verifiedAt}; fixed in ${evidence.firstFixedVersion}. ${evidence.status === "recheck" ? "Evidence expired; run a fresh read-only version check." : "Dated check, not continuous attestation."}` : finding.nextStep}</small></td>
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
          <span>{String(visible.length).padStart(2, "0")} SHOWN / {String(findings.length).padStart(2, "0")} TRACKED · {verified} PATCHES VERIFIED</span>
          <span>Automated sources: OSV + NVD + vendor bulletins · Version and scope matching</span>
        </div>
      </section>

      <div className={styles.sectionHead} id="sw-catalog">
        <span>REGISTERED PRODUCTS & OWNERSHIP</span><span>MANUALLY MAINTAINED CATALOG</span>
      </div>
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div><h2>Products under watch</h2><p>Verified releases reflect one-time deployment checks, not continuous runtime attestation. Legacy sources stay listed but are excluded from scans.</p></div>
          <span className={styles.counter}>{productCatalog.length} PRODUCTS</span>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.catalogTable}>
            <thead><tr><th>Product</th><th>Registered technology / version</th><th>Responsible team</th><th>Monitoring</th></tr></thead>
            <tbody>{productCatalog.map((product) => (
              <tr key={product.id}>
                <td><strong>{product.name}</strong><small>{product.environment}</small>
                  {product.releaseVerification && <small className={styles.releaseEvidence}>
                    PATCH VERIFIED · {product.releaseVerification.technology} {product.releaseVerification.version} · {product.releaseVerification.checkedAt}
                  </small>}
                  {product.environment === "legacy" && <small className={styles.legacyNote}>Historical source only · Not deployed or monitored</small>}
                </td>
                <td><div className={styles.pills}>{product.technologies.length
                  ? product.technologies.map((tech) => <span key={tech.id}>{tech.name} {tech.version}</span>)
                  : <span>Profile not submitted</span>}</div></td>
                <td className={styles.team}>{product.team}</td>
                <td><span className={product.environment === "legacy" ? styles.legacy : product.enabled ? styles.active : styles.pending}>
                  {product.environment === "legacy" ? "LEGACY · EXCLUDED" : product.enabled ? "MONITORED" : "AWAITING SETUP"}</span></td>
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
              <small>{run.findings} saved at scan time (historical)</small>
            </div>)}
          </div>
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHead}><div><h2>What you need to do</h2><p>One simple, notification-driven workflow.</p></div><ShieldCheck size={18} color="#ed6675"/></div>
          <div className={styles.instructions}>
            <p><BellRing size={16}/> <strong>01 / Receive a notification.</strong> Only new high-priority matches trigger email.</p>
            <p><ShieldAlert size={16}/> <strong>02 / See the product and owner.</strong> Check the advisory table above.</p>
            <p><DatabaseZap size={16}/> <strong>03 / Copy diagnosis to your AI.</strong> The product team verifies and handles fixes.</p>
            {!notificationsConfigured && <p className={styles.warningText}>Email alerts are not configured. Automatic notifications are not active.</p>}
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
