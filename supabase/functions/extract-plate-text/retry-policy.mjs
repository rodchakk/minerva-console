// Pure OCR error policy. Keep contract failures terminal and provider outages bounded.
// No image, provider response, plate, credential, or user data enters this module.
const NON_RETRYABLE_ERRORS = new Set([
  "OCR_INVALID_OUTPUT",
  "OCR_IMAGE_NOT_FOUND",
  "OCR_IMAGE_STORAGE_REJECTED",
  "OCR_REQUEST_IMAGE_PATH_REQUIRED",
  "OCR_REQUEST_UNSUPPORTED_BUCKET",
  "OCR_REQUEST_ENTRY_LOG_NOT_FOUND",
  "OCR_REQUEST_COMMUNITY_MISSING",
  "OCR_REQUEST_IMAGE_MISMATCH",
]);

/** @param {string} errorCode */
export function shouldRetryOcrError(errorCode) {
  if (NON_RETRYABLE_ERRORS.has(errorCode)) return false;

  if (errorCode.startsWith("GEMINI_HTTP_")) {
    const status = Number(errorCode.slice("GEMINI_HTTP_".length));
    return status === 408 || status === 429 || (status >= 500 && status <= 599);
  }

  // Network/timeout, malformed provider transport, temporary storage/DB,
  // and unknown failures retain the existing max_attempts/backoff safeguard.
  return true;
}

/** @param {unknown} error */
export function storageErrorStatus(error) {
  if (!error || typeof error !== "object") return null;
  const { statusCode, status } = /** @type {{statusCode?: unknown, status?: unknown}} */ (error);
  const raw = statusCode ?? status;
  if (raw === null || raw === undefined || raw === "") return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 100 && parsed <= 599
    ? parsed
    : null;
}
