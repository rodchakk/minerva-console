import type { LucideIcon } from "lucide-react";
import { BrainCircuit, CircleGauge, Database, Grid2X2, Lock } from "lucide-react";

export type ProductKind = "native" | "external";
export type ProductStatus =
  | "operational"
  | "development"
  | "disconnected"
  | "locked"
  | "error";
export type ProductConnectionMode =
  | "native_module"
  | "link_only"
  | "overview_api"
  | "future_full_integration";

export type ProductMetric = {
  label: string;
  value: string;
};

export type ProductConnection = {
  adminUrl: string | null;
  overviewEndpoint: string | null;
};

export type ProductModule = {
  availability: "available" | "coming_later" | "restricted";
  connection: ProductConnection;
  connectionMode: ProductConnectionMode;
  description: string;
  environment: "production" | "development" | "external";
  href: string | null;
  icon: LucideIcon;
  id: string;
  kind: ProductKind;
  metrics: ProductMetric[];
  name: string;
  owner: string;
  slug: string;
  status: ProductStatus;
  statusLabel: string;
};

export const productModules: ProductModule[] = [
  {
    availability: "available",
    connection: {
      adminUrl: "/products/entry",
      overviewEndpoint: null,
    },
    connectionMode: "native_module",
    description:
      "Native module for community onboarding, operations, users, messages, tickets and settings.",
    environment: "production",
    href: "/products/entry",
    icon: Grid2X2,
    id: "entry",
    kind: "native",
    metrics: [
      { label: "Module", value: "Native" },
      { label: "Route", value: "/products/entry" },
      { label: "Connection", value: "Console auth" },
    ],
    name: "ENTRY",
    owner: "Minerva Console",
    slug: "entry",
    status: "operational",
    statusLabel: "Operational",
  },
  {
    availability: "coming_later",
    connection: {
      adminUrl: null,
      overviewEndpoint: null,
    },
    connectionMode: "native_module",
    description:
      "Future native Minerva module. Reserved in Console without a fake product surface.",
    environment: "development",
    href: null,
    icon: CircleGauge,
    id: "seshat",
    kind: "native",
    metrics: [
      { label: "Module", value: "Native" },
      { label: "Route", value: "Reserved" },
      { label: "Connection", value: "Not active" },
    ],
    name: "Seshat",
    owner: "Minerva Technologies",
    slug: "seshat",
    status: "development",
    statusLabel: "In development",
  },
];

export const restrictedProductStateExample: ProductModule = {
  availability: "restricted",
  connection: {
    adminUrl: "https://product.example.com/admin",
    overviewEndpoint: null,
  },
  connectionMode: "link_only",
  description:
    "Presentation state for a real registered module that is unavailable to the current operator.",
  environment: "external",
  href: null,
  icon: Lock,
  id: "restricted-product-state-example",
  kind: "external",
  metrics: [
    { label: "Access", value: "Restricted" },
    { label: "Mode", value: "Link only" },
    { label: "State", value: "Locked" },
  ],
  name: "Restricted product state example",
  owner: "Future product owner",
  slug: "restricted-product-state",
  status: "locked",
  statusLabel: "Locked",
};

export const integrationKitActions = [
  {
    description: "Markdown-first contract for a future clean integration-kit repository.",
    href: "/products/add",
    icon: Database,
    label: "MINERVA_CONNECTOR.md",
  },
  {
    description: "AI handoff prompt generated from product metadata and allowed data rules.",
    href: "/products/add",
    icon: BrainCircuit,
    label: "Copy AI Instructions",
  },
];
