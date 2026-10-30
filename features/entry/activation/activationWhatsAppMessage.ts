export type ActivationWhatsAppMessageInput = {
  communityName: string;
  residentName: string;
  unitLabel: string;
  pin: string;
};

// A human-readable handoff for WhatsApp (normal/personal accounts).
// No PIN is sent to WhatsApp automatically or placed in a URL.
export function buildActivationWhatsAppMessage({
  communityName,
  residentName,
  unitLabel,
  pin,
}: ActivationWhatsAppMessageInput) {
  return [
    "ENTRY · Activación de residente",
    `Residencial: ${communityName}`,
    `Residente: ${residentName}`,
    `Unidad: ${unitLabel}`,
    `PIN de activación: ${pin}`,
    "",
    "Abre la aplicación ENTRY, selecciona Activar cuenta e ingresa este PIN.",
    "Este PIN vence en 7 días desde su generación y solo debe compartirse con la persona autorizada.",
  ].join("\n");
}
