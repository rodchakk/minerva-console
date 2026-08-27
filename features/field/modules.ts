export type FieldModule = {
  id: "entry";
  label: string;
  href: "/field/entry";
  summary: string;
};

export const FIELD_MODULES = [
  {
    id: "entry",
    label: "ENTRY",
    href: "/field/entry",
    summary: "Mobile surface for ENTRY field operations.",
  },
] as const satisfies ReadonlyArray<FieldModule>;
