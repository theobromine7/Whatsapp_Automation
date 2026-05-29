import { logger } from "./logger";

export async function sendWhatsappMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  message: string
): Promise<void> {
  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body: message },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error({ status: response.status, error }, "Failed to send WhatsApp message");
    throw new Error(`WhatsApp API error: ${response.status}`);
  }

  logger.info({ to, phoneNumberId }, "WhatsApp message sent");
}
