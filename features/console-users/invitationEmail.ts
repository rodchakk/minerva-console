import "server-only";
import { Resend } from "resend";
import { getConsoleInviteRedirectUrl } from "@/features/console-users/model";

export type ConsoleSetupLinkType = "invite" | "recovery";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function requireConsoleEmailDelivery() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Console email delivery is not configured.");
  }
}

export function buildConsoleSetupUrl(tokenHash: string, type: ConsoleSetupLinkType) {
  // Use our own callback, not Supabase's shared ENTRY-branded auth template.
  const url = new URL(getConsoleInviteRedirectUrl());
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", type);
  return url.toString();
}

export async function sendConsoleSetupEmail(input: {
  displayName: string | null;
  email: string;
  tokenHash: string;
  type: ConsoleSetupLinkType;
}) {
  requireConsoleEmailDelivery();
  const link = buildConsoleSetupUrl(input.tokenHash, input.type);
  const name = escapeHtml(input.displayName || "there");
  const safeLink = escapeHtml(link);
  const subject = input.type === "invite"
    ? "You've been invited to Minerva Console"
    : "Finish setting up your Minerva Console access";

  const html = [
    '<!doctype html><html><body style="margin:0;padding:32px 16px;background:#101015;color:#f8fafc;font-family:Arial,Helvetica,sans-serif;">',
    '<div style="max-width:540px;margin:auto;padding:32px;border:1px solid #37313b;border-top:4px solid #dc2626;border-radius:8px;background:#211e25;">',
    '<p style="font-size:12px;font-weight:700;letter-spacing:2px;color:#f87171;margin-top:0;">MINERVA TECHNOLOGIES</p>',
    '<h1 style="font-size:25px;margin:16px 0;color:#fff;">Minerva Console invitation</h1>',
    '<p style="line-height:1.7;color:#d1d5db;">Hello ' + name + ',</p>',
    '<p style="line-height:1.7;color:#d1d5db;">You have been granted access to Minerva Console. Use the secure link below to create your password and enter your workspace.</p>',
    '<p style="margin:30px 0;"><a href="' + safeLink + '" style="display:inline-block;background:#dc2626;color:#fff;padding:14px 20px;border-radius:6px;font-weight:700;text-decoration:none;">Set up my account</a></p>',
    '<p style="font-size:13px;line-height:1.6;color:#a3a3a3;">If the button does not work, copy and paste this link into your browser:</p>',
    '<p style="font-size:12px;line-height:1.7;overflow-wrap:anywhere;"><a href="' + safeLink + '" style="color:#fca5a5;">' + safeLink + '</a></p>',
    '<p style="font-size:12px;line-height:1.6;color:#a3a3a3;">This link is private and expires. If it no longer works, ask your Minerva Console administrator to resend it. If you did not expect an invitation, ignore this message.</p>',
    '<p style="border-top:1px solid #37313b;padding-top:18px;margin-top:24px;font-size:12px;color:#9ca3af;">Minerva Technologies · Secure Console Access</p>',
    '</div></body></html>',
  ].join("");

  const { data, error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: "Minerva Technologies <no-reply@minervatechs.com>",
    to: [input.email],
    subject,
    html,
    text: [
      "Hello " + (input.displayName || "there") + ",",
      "",
      "You have been granted access to Minerva Console.",
      "Create your password using this private, expiring link:",
      link,
      "",
      "If this link has expired, ask your Console administrator for a new one.",
      "If you did not expect this invitation, ignore this email.",
      "",
      "Minerva Technologies",
    ].join("\n"),
  });

  if (error || !data?.id) {
    console.error("[console-users] Console email provider refused invitation", {
      name: error?.name ?? "unknown",
    });
    throw new Error("Minerva Console invitation email could not be sent.");
  }
}
