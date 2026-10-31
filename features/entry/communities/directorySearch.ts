// Shared by the server and the client so directory lookups behave identically.
// Multiple words can match across separate fields (label, reference, resident).
function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function matchesDirectorySearch(query: string, values: string[]) {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const searchable = normalizeSearch(values.join(" "));
  return terms.every((term) => searchable.includes(term));
}
