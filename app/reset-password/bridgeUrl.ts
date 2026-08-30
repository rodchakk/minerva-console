export const ENTRY_RESET_DEEP_LINK_BASE = "entry://reset-password";

export function buildEntryResetUrl(search = "", hash = "") {
  return `${ENTRY_RESET_DEEP_LINK_BASE}${search}${hash}`;
}
