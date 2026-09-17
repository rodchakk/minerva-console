const CONFIGURED_UNIT_LABEL_PREFIXES: Record<string, string> = {
  apartamentos: "Apartamento",
  casas: "Casa",
  condominios: "Condominio",
  oficinas: "Oficina",
  villas: "Villa",
};

export function normalizeCommunityUnitLabelPrefix(
  configuredUnitLabel: string | null | undefined,
) {
  const trimmed = normalizeUnitLabelSegment(configuredUnitLabel ?? "");
  if (!trimmed) return "";

  const configuredPrefix =
    CONFIGURED_UNIT_LABEL_PREFIXES[trimmed.toLocaleLowerCase("es-GT")];
  if (configuredPrefix) return configuredPrefix;

  if (/^[A-Za-z]+s$/.test(trimmed)) {
    return trimmed.slice(0, -1);
  }

  return trimmed;
}

export function canonicalizeCommunityUnitLabel(
  unitLabelPrefix: string,
  unitLabel: string,
) {
  const prefix = normalizeCommunityUnitLabelPrefix(unitLabelPrefix);
  const normalizedLabel = normalizeUnitLabelSegment(unitLabel);

  if (!normalizedLabel) return "";
  if (!prefix) return normalizedLabel;

  if (hasCommunityUnitPrefix(normalizedLabel, prefix)) {
    const suffix = normalizeUnitLabelSegment(
      normalizedLabel.slice(prefix.length),
    );

    return suffix ? `${prefix} ${suffix}` : prefix;
  }

  return `${prefix} ${normalizedLabel}`.trim();
}

export function buildCommunityUnitLookupLabel(
  unitLabelPrefix: string,
  unitSuffix: string,
) {
  return canonicalizeCommunityUnitLabel(unitLabelPrefix, unitSuffix);
}

export function hasCommunityUnitPrefix(value: string, unitLabelPrefix: string) {
  const normalizedValue = normalizeUnitLabelSegment(value).toLocaleLowerCase("es-GT");
  const normalizedPrefix = normalizeCommunityUnitLabelPrefix(
    unitLabelPrefix,
  ).toLocaleLowerCase("es-GT");

  if (!normalizedPrefix) return false;

  return (
    normalizedValue === normalizedPrefix ||
    normalizedValue.startsWith(`${normalizedPrefix} `)
  );
}

function normalizeUnitLabelSegment(value: string) {
  return value.trim().replace(/\s+/g, " ");
}
