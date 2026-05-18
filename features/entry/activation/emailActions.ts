"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { generateActivationPins } from "@/features/entry/activation/pinActions";
import { createClient } from "@/lib/supabase/server";

async function getActivationBaseUrl(): Promise<string> {
  const publicConsoleUrl =
    process.env.NEXT_PUBLIC_MINERVA_CONSOLE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (publicConsoleUrl) {
    return publicConsoleUrl.replace(/\/$/, "");
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.includes("localhost") ? "http" : "https");

  if (host) {
    return `${protocol}://${host}`;
  }

  return "";
}

export type SendEmailInviteResult = {
  success: boolean;
  error?: string;
  data?: {
    sent_count: number;
    failed_count: number;
    skipped_count: number;
    items: Array<{
      queue_id: string;
      email: string;
      status: "sent" | "failed" | "skipped";
      message?: string;
    }>;
  };
};

export async function sendActivationEmails(input: {
  communityId: string;
  communityName: string;
  queueIds: string[];
}): Promise<SendEmailInviteResult> {
  await requireSuperadmin();

  const { communityId, communityName, queueIds } = input;

  if (!communityId) {
    return { success: false, error: "No community selected." };
  }

  if (!queueIds.length) {
    return { success: false, error: "No residents selected." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "Resend API key is not configured. Please add RESEND_API_KEY to your environment variables.",
    };
  }

  const resend = new Resend(apiKey);

  // 1. Generate or retrieve PINs for all selected users
  const pinResult = await generateActivationPins({ communityId, queueIds });

  if (!pinResult.success) {
    return {
      success: false,
      error: `Failed to prepare activation PINs: ${pinResult.error}`,
    };
  }

  const items = pinResult.data.items;
  const emailResults: NonNullable<SendEmailInviteResult["data"]>["items"] = [];
  const successfullyInvitedIds: string[] = [];

  let sent_count = 0;
  let failed_count = 0;
  let skipped_count = 0;

  const baseUrl = await getActivationBaseUrl();

  // 2. Iterate and send emails
  for (const item of items) {
    if (!item.email || item.activation_method !== "email") {
      skipped_count++;
      emailResults.push({
        queue_id: item.queue_id,
        email: item.email ?? "No email",
        status: "skipped",
        message: "No email address or invalid activation method",
      });
      continue;
    }

    if (item.status === "failed") {
      failed_count++;
      emailResults.push({
        queue_id: item.queue_id,
        email: item.email,
        status: "failed",
        message: item.message || "Failed during PIN generation",
      });
      continue;
    }

    const activationLink = baseUrl
      ? `${baseUrl}/activate?pin=${item.pin}`
      : `entry://activate?pin=${item.pin}`;

    try {
      const { error: resendError } = await resend.emails.send({
        from: "ENTRY <no-reply@minervatechs.com>",
        to: [item.email],
        subject: `Your ENTRY Activation Code for ${communityName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2>Welcome to ENTRY</h2>
            <p>Hello ${item.resident_name || "Resident"},</p>
            <p>Your account for <strong>${communityName}</strong> (Unit: ${item.unit_label || "-"}) is ready to be activated.</p>
            
            <div style="margin: 30px 0; padding: 20px; background-color: #f4f4f5; border-radius: 12px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #666;">Activation PIN</p>
              <p style="margin: 10px 0 0 0; font-size: 32px; font-weight: bold; font-family: monospace; letter-spacing: 4px; color: #6d28d9;">
                ${item.pin}
              </p>
            </div>

            <p style="margin-bottom: 24px;">Click the button below on your mobile device to open the ENTRY app and set your password:</p>
            
            <a href="${activationLink}" style="display: inline-block; background-color: #6d28d9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Activate Account
            </a>

            <p style="margin-top: 30px; font-size: 14px; color: #666;">
              If the button doesn't work, open the ENTRY app and enter the PIN manually.<br/>
              <em>This PIN will expire in 7 days.</em>
            </p>
          </div>
        `,
      });

      if (resendError) {
        throw new Error(resendError.message);
      }

      sent_count++;
      successfullyInvitedIds.push(item.queue_id);
      emailResults.push({
        queue_id: item.queue_id,
        email: item.email,
        status: "sent",
      });
    } catch (err) {
      failed_count++;
      emailResults.push({
        queue_id: item.queue_id,
        email: item.email,
        status: "failed",
        message: err instanceof Error ? err.message : "Unknown email error",
      });
    }
  }

  // 3. Update status in database for those who successfully received an email
  if (successfullyInvitedIds.length > 0) {
    try {
      const supabase = await createClient();
      await supabase
        .from("resident_activation_queue")
        .update({ status: "invited", updated_at: new Date().toISOString() })
        .in("id", successfullyInvitedIds);
      
      revalidatePath("/products/entry/activation");
    } catch (dbErr) {
      console.error("Failed to update resident_activation_queue status to invited", dbErr);
      // We don't fail the whole action if the email was already sent, but it's an edge case.
    }
  }

  return {
    success: true,
    data: {
      sent_count,
      failed_count,
      skipped_count,
      items: emailResults,
    },
  };
}
