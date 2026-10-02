type AuthErrorLike = {
  status?: number;
  code?: string;
  message?: string;
};

const VERIFIED_INVALID_SESSION_CODES = new Set([
  "bad_jwt",
  "invalid_jwt",
  "refresh_token_not_found",
  "refresh_token_already_used",
  "session_not_found",
  "user_not_found",
]);

export function isVerifiedInvalidSession(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const authError = error as AuthErrorLike;
  const code = String(authError.code ?? "").toLowerCase();
  const message = String(authError.message ?? "").toLowerCase();

  if (VERIFIED_INVALID_SESSION_CODES.has(code)) {
    return true;
  }

  if (authError.status !== 401) {
    return false;
  }

  return (
    message.includes("invalid jwt") ||
    message.includes("invalid claim") ||
    message.includes("session not found") ||
    message.includes("user not found") ||
    message.includes("refresh token not found")
  );
}
