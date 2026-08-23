"use server";

import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { generateActivationPins } from "@/features/entry/activation/pinActions";
import {
  getEntryPreviewReadOnlyError,
  getResidentFacingBaseUrl,
} from "@/features/entry/deploymentBoundary";
import { createClient } from "@/lib/supabase/server";

type ActivationInviteEmailInput = {
  activationLink: string;
  communityName: string;
  pin: string;
  residentName: string;
  unitLabel: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildActivationInviteEmail(
  input: ActivationInviteEmailInput,
  locale: "es" = "es",
) {
  const communityName = escapeHtml(input.communityName);
  const residentName = escapeHtml(input.residentName || "residente");
  const unitLabel = escapeHtml(input.unitLabel || "-");
  const activationLink = escapeHtml(input.activationLink);
  const pin = escapeHtml(input.pin);

  switch (locale) {
    case "es":
    default:
      return {
        subject: `Activa tu cuenta de ENTRY - ${input.communityName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
            <h2 style="color: #111827;">Activa tu cuenta de ENTRY</h2>
            <p>Hola ${residentName},</p>
            <p>Tu cuenta para <strong>${communityName}</strong> (unidad: ${unitLabel}) está lista para activarse.</p>

            <div style="margin: 30px 0; padding: 20px; background-color: #f4f4f5; border-radius: 12px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #52525b;">PIN de activación</p>
              <p style="margin: 10px 0 0 0; font-size: 32px; font-weight: bold; font-family: monospace; letter-spacing: 4px; color: #6d28d9;">
                ${pin}
              </p>
            </div>

            <p style="margin-bottom: 24px;">Abre ENTRY desde tu teléfono o continúa en el navegador para crear tu contraseña.</p>

            <a href="${activationLink}" style="display: inline-block; background-color: #6d28d9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Activar mi cuenta
            </a>

            <p style="margin-top: 30px; font-size: 14px; color: #52525b;">
              Si el botón no abre, entra a ENTRY y escribe el PIN manualmente.<br/>
              <em>Este PIN vence en 7 días.</em>
            </p>
          </div>
        `,
      };
  }
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
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { success: false, error: previewReadOnlyError };
  }

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

  const baseUrl = await getResidentFacingBaseUrl();

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
    const emailContent = buildActivationInviteEmail({
      activationLink,
      communityName,
      pin: item.pin ?? "",
      residentName: item.resident_name || "residente",
      unitLabel: item.unit_label || "-",
    });

    try {
      const { error: resendError } = await resend.emails.send({
        from: "ENTRY <no-reply@minervatechs.com>",
        to: [item.email],
        subject: emailContent.subject,
        html: emailContent.html,
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
      const inviteSentAt = new Date().toISOString();
      // Resends move invite_sent_at to the latest successful accepted delivery.
      await supabase
        .from("resident_activation_queue")
        .update({
          invite_sent_at: inviteSentAt,
          status: "invited",
          updated_at: inviteSentAt,
        })
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
