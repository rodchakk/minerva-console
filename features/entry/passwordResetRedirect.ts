import { getResidentFacingBaseUrl } from "@/features/entry/deploymentBoundary";
import { resolvePasswordResetRedirect } from "@/features/entry/passwordResetRedirectPolicy";

export async function getPasswordResetRedirectTo() {
  return resolvePasswordResetRedirect({
    configuredRedirect: process.env.NEXT_PUBLIC_ENTRY_PASSWORD_RESET_REDIRECT,
    residentBaseUrl: await getResidentFacingBaseUrl(),
  });
}
