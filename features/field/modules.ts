export type FieldModule = {
  id: "entry" | "indoor";
  label: string;
  href: "/field/entry" | "/field/indoor";
  summary: string;
};

export const FIELD_MODULES = [
  {
    id: "entry",
    label: "ENTRY",
    href: "/field/entry",
    summary: "Mobile surface for ENTRY field operations.",
  },
  {
    id: "indoor",
    label: "INDOOR",
    href: "/field/indoor",
    summary: "Indoor routes and GPS field testing (pilot).",
  },
] as const satisfies ReadonlyArray<FieldModule>;
