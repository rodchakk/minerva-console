"use client";

import { useActionState, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  Download,
  FileText,
  Radio,
  Settings2,
} from "lucide-react";
import {
  testProductConnectionAction,
  type TestConnectionState,
} from "@/features/control-center/actions";
import { cn } from "@/lib/supabase/utils";

const initialConnectionState: TestConnectionState = {
  detail: "Enter manual values, then run an explicit read-only connection test.",
  status: "idle",
  title: "Waiting for manual configuration",
};

function Field({
  hint,
  label,
  name,
  onChange,
  placeholder,
  required = false,
  type = "text",
  value,
}: {
  hint?: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--console-text-muted)]">
        {label}
      </span>
      <input
        name={name}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
        className="mt-2 h-10 w-full rounded-md border border-white/[0.10] bg-white/[0.035] px-3 text-sm text-white outline-none transition-colors placeholder:text-[var(--console-text-soft)] focus:border-[#ff4d4d]/50"
      />
      {hint ? (
        <span className="mt-1 block text-xs leading-5 text-[var(--console-text-muted)]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function TextArea({
  label,
  name,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  name: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--console-text-muted)]">
        {label}
      </span>
      <textarea
        name={name}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        value={value}
        className="mt-2 w-full resize-none rounded-md border border-white/[0.10] bg-white/[0.035] px-3 py-2 text-sm leading-6 text-white outline-none transition-colors placeholder:text-[var(--console-text-soft)] focus:border-[#ff4d4d]/50"
      />
    </label>
  );
}

function Select({
  children,
  label,
  name,
  onChange,
  value,
}: {
  children: React.ReactNode;
  label: string;
  name: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--console-text-muted)]">
        {label}
      </span>
      <select
        name={name}
        onChange={(event) => onChange(event.target.value)}
        value={value}
        className="mt-2 h-10 w-full rounded-md border border-white/[0.10] bg-[#202225] px-3 text-sm text-white outline-none transition-colors focus:border-[#ff4d4d]/50"
      >
        {children}
      </select>
    </label>
  );
}

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildInstructions({
  adminUrl,
  connectionMode,
  description,
  environment,
  name,
  owner,
  overviewEndpoint,
  productType,
  slug,
}: {
  adminUrl: string;
  connectionMode: string;
  description: string;
  environment: string;
  name: string;
  owner: string;
  overviewEndpoint: string;
  productType: string;
  slug: string;
}) {
  const displayName = name || "New Product";
  const displaySlug = slug || "new-product";

  return `# MINERVA_CONNECTOR.md

Product: ${displayName}
Slug: ${displaySlug}
Type: ${productType}
Environment: ${environment}
Owner: ${owner || "TBD"}
Connection mode: ${connectionMode}
Admin/module URL: ${adminUrl || "Manual value required"}
Overview endpoint: ${overviewEndpoint || "Not configured"}

## Mission

Connect ${displayName} to Minerva Console through the V1 manual guided product setup flow.

## Scope

- Implement only the selected connection mode.
- Keep the product as the source of truth for its own data and business logic.
- Use read-only overview data only.
- Do not write product data into Brain.
- Do not modify ENTRY or Brain unless a separate mission explicitly grants that scope.
- Do not add background polling, cron monitoring, event streaming, paid observability, or AI API calls.

## Product Context

${description || "No description provided yet."}

## Expected V1 Overview API Shape

\`\`\`json
{
  "status": "operational",
  "users": 247,
  "alerts": 0,
  "lastActivity": "2026-09-01T21:40:00Z"
}
\`\`\`

## Return To Console With

- Final Admin/module URL
- Final overview endpoint if using Overview API
- Any server-only credential instructions if a later mission approves credentials
- Verification notes for the operator to run Test connection manually
`;
}

export function AddProductFlow() {
  const [name, setName] = useState("ENTRY");
  const [slug, setSlug] = useState("entry");
  const [description, setDescription] = useState(
    "Native Minerva module for community onboarding and operational workflows.",
  );
  const [icon, setIcon] = useState("grid");
  const [productType, setProductType] = useState("native");
  const [environment, setEnvironment] = useState("production");
  const [adminUrl, setAdminUrl] = useState("/products/entry");
  const [connectionMode, setConnectionMode] = useState("native_module");
  const [overviewEndpoint, setOverviewEndpoint] = useState("");
  const [owner, setOwner] = useState("Minerva Console");
  const [copyState, setCopyState] = useState("Copy AI Instructions");
  const [connectionState, formAction, pending] = useActionState(
    testProductConnectionAction,
    initialConnectionState,
  );

  const instructions = useMemo(
    () =>
      buildInstructions({
        adminUrl,
        connectionMode,
        description,
        environment,
        name,
        owner,
        overviewEndpoint,
        productType,
        slug,
      }),
    [
      adminUrl,
      connectionMode,
      description,
      environment,
      name,
      owner,
      overviewEndpoint,
      productType,
      slug,
    ],
  );

  function handleNameChange(value: string) {
    setName(value);
    if (!slug || slug === makeSlug(name)) {
      setSlug(makeSlug(value));
    }
  }

  async function copyInstructions() {
    await navigator.clipboard.writeText(instructions);
    setCopyState("Copied");
    window.setTimeout(() => setCopyState("Copy AI Instructions"), 1600);
  }

  function downloadInstructions() {
    const blob = new Blob([instructions], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slug || "minerva"}-connector.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-4">
      <section className="flex flex-col gap-4 px-0.5 pt-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-normal text-white lg:text-[2rem]">
            Add Product
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--console-text-muted)]">
            Manual V1 setup: enter product information, hand off the generated
            instructions, return with connection values, then run Test connection.
          </p>
        </div>
      </section>

      <form action={formAction} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_520px]">
        <section className="rounded-lg border border-white/[0.10] bg-[#181a1d]">
          <div className="border-b border-white/[0.10] px-5 py-4">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-slate-300 stroke-[1.75]" />
              <h2 className="text-base font-semibold text-white">Manual Configuration</h2>
            </div>
          </div>

          <div className="grid gap-5 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Name"
                name="name"
                onChange={handleNameChange}
                required
                value={name}
              />
              <Field
                hint="Stable URL/config identifier."
                label="Slug"
                name="slug"
                onChange={setSlug}
                required
                value={slug}
              />
              <Field
                hint="Short visual identifier for the registry."
                label="Icon / mark"
                name="icon"
                onChange={setIcon}
                value={icon}
              />
              <Field
                label="Owner"
                name="owner"
                onChange={setOwner}
                value={owner}
              />
            </div>

            <TextArea
              label="Description"
              name="description"
              onChange={setDescription}
              value={description}
            />

            <div className="grid gap-4 md:grid-cols-3">
              <Select
                label="Product type"
                name="productType"
                onChange={setProductType}
                value={productType}
              >
                <option value="native">Native Minerva module</option>
                <option value="external">External / connected product</option>
              </Select>
              <Select
                label="Environment"
                name="environment"
                onChange={setEnvironment}
                value={environment}
              >
                <option value="production">Production</option>
                <option value="development">Development</option>
                <option value="external">External</option>
              </Select>
              <Select
                label="Connection mode"
                name="connectionMode"
                onChange={setConnectionMode}
                value={connectionMode}
              >
                <option value="native_module">Native module</option>
                <option value="link_only">Link only</option>
                <option value="overview_api">Overview API</option>
                <option value="future_full_integration" disabled>
                  Full integration (future)
                </option>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                hint="Native route or external admin URL. External URLs must be http/https for testing."
                label="Admin / module URL"
                name="adminUrl"
                onChange={setAdminUrl}
                placeholder="https://product.example.com/admin"
                value={adminUrl}
              />
              <Field
                hint="Required only for Overview API mode."
                label="Overview endpoint"
                name="overviewEndpoint"
                onChange={setOverviewEndpoint}
                placeholder="https://product.example.com/api/minerva/overview"
                value={overviewEndpoint}
              />
            </div>

            <div className="rounded-lg border border-white/[0.10] bg-white/[0.02] p-4">
              <h3 className="text-sm font-semibold text-white">V1 setup path</h3>
              <div className="mt-3 grid gap-2 text-sm text-[var(--console-text-muted)] md:grid-cols-3">
                {[
                  "Generate instructions",
                  "Implement manually",
                  "Return and Test connection",
                ].map((step) => (
                  <p key={step} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#ff4d4d] stroke-[1.75]" />
                    {step}
                  </p>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/[0.10] bg-white/[0.045] px-3.5 text-sm font-semibold text-white transition-colors hover:border-white/[0.18] hover:bg-white/[0.07]"
                type="button"
                onClick={copyInstructions}
              >
                <Clipboard className="h-4 w-4 text-[#ff4d4d] stroke-[1.75]" />
                {copyState}
              </button>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/[0.10] bg-white/[0.025] px-3.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/[0.18] hover:bg-white/[0.045]"
                type="button"
                onClick={downloadInstructions}
              >
                <Download className="h-4 w-4 stroke-[1.75]" />
                Download Integration Kit
              </button>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#ff4d4d]/35 bg-white/[0.025] px-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff4d4d]/10 disabled:cursor-wait disabled:text-slate-400"
                disabled={pending}
                type="submit"
              >
                <Radio className="h-4 w-4 text-[#ff4d4d] stroke-[1.75]" />
                {pending ? "Testing" : "Test connection"}
              </button>
            </div>

            <div
              className={cn(
                "rounded-lg border px-4 py-3",
                connectionState.status === "success"
                  ? "border-emerald-400/25 bg-emerald-500/[0.06]"
                  : connectionState.status === "error"
                    ? "border-amber-400/25 bg-amber-500/[0.06]"
                    : "border-white/[0.10] bg-white/[0.02]",
              )}
            >
              <p className="text-sm font-semibold text-white">{connectionState.title}</p>
              <p className="mt-1 text-sm leading-6 text-[var(--console-text-muted)]">
                {connectionState.detail}
              </p>
            </div>
          </div>
        </section>

        <aside className="rounded-lg border border-white/[0.10] bg-[#181a1d]">
          <div className="flex items-center gap-2 border-b border-white/[0.10] px-5 py-4">
            <FileText className="h-4 w-4 text-slate-300 stroke-[1.75]" />
            <h2 className="text-base font-semibold text-white">Generated Instructions</h2>
          </div>
          <pre className="max-h-[760px] overflow-auto whitespace-pre-wrap p-5 text-xs leading-6 text-slate-300">
            {instructions}
          </pre>
        </aside>
      </form>
    </div>
  );
}
