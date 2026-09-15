import "server-only";

export function normalizeSetupUnitIdentity(value: string | null) {
  const normalized =
    value
      ?.normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLocaleLowerCase("es-GT")
      .replace(/[^a-z0-9]+/g, "") ?? "";

  return normalized || null;
}
