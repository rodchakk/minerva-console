/**
 * Lightweight WhatsApp follow-up for unactivated ENTRY residents.
 * No credentials, message bodies, or phone numbers are persisted by this helper.
 * A wa.me link only opens a draft; it cannot establish delivery or contact.
 */
export const WHATSAPP_FOLLOWUP_INVITATION_THRESHOLD = 5;

const OPEN_ACTIVATION_STATES = new Set(["pending", "pin_generated", "invited"]);
const HONDURAS_MOBILE = /^[3789]\d{7}$/;

/**
 * Formats Honduran 8-digit mobile numbers as 504XXXXXXXX.
 * International numbers require an explicit + or 00 prefix (except 504XXXXXXXX).
 * This verifies syntax only; it does not prove a WhatsApp account exists.
 */
export function normalizeWhatsAppPhone(rawPhone: string): string | null {
  const phone = rawPhone.trim();
  if (!phone || !/^\+?[0-9() .-]+$/.test(phone)) return null;

  let digits = phone.replace(/\D/g, "");
  const international = phone.startsWith("+") || digits.startsWith("00");

  if (digits.startsWith("00")) {
    if (phone.startsWith("+")) return null;
    digits = digits.slice(2);
  }

  if (!international && digits.length === 8) {
    digits = `504${digits}`;
  } else if (!international && !(digits.length === 11 && digits.startsWith("504"))) {
    return null; // Ambiguous international number: require +country code.
  }

  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  if (digits.startsWith("504") && digits.length === 11 && !HONDURAS_MOBILE.test(digits.slice(3))) {
    return null;
  }

  return digits;
}

export function shouldOfferWhatsAppFollowUp(row: {
  status: string;
  invitationAttemptCount: number;
}): boolean {
  return (
    OPEN_ACTIVATION_STATES.has(row.status) &&
    row.invitationAttemptCount >= WHATSAPP_FOLLOWUP_INVITATION_THRESHOLD
  );
}

export function buildWhatsAppFollowUpMessage(communityName: string): string {
  const community = communityName.trim();
  const forCommunity = community ? ` para ${community}` : "";
  return (
    "Hola, le saludamos del equipo de ENTRY de Minerva Technologies. " +
    `Queremos ayudarle a completar la activación de su cuenta${forCommunity}. ` +
    "¿Podemos apoyarle con el proceso?"
  );
}

export function buildWhatsAppFollowUpUrl(
  rawPhone: string,
  communityName: string,
): string | null {
  const phone = normalizeWhatsAppPhone(rawPhone);
  if (!phone) return null;

  return `https://wa.me/${phone}?text=${encodeURIComponent(buildWhatsAppFollowUpMessage(communityName))}`;
}
