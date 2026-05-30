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

/**
 * Upload an image buffer to WhatsApp Media API and return the media ID.
 */
async function uploadWhatsappMedia(
  phoneNumberId: string,
  accessToken: string,
  imageBuffer: Buffer,
  mimeType = "image/png"
): Promise<string> {
  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/media`;

  const formData = new FormData();
  formData.append("messaging_product", "whatsapp");
  formData.append("type", mimeType);
  const blob = new Blob([imageBuffer], { type: mimeType });
  formData.append("file", blob, "payment_qr.png");

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error({ status: response.status, error }, "Failed to upload WhatsApp media");
    throw new Error(`WhatsApp media upload error: ${response.status}`);
  }

  const data = await response.json() as { id: string };
  return data.id;
}

/**
 * Send an image message via Meta Cloud API.
 */
export async function sendWhatsappImage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  imageBuffer: Buffer,
  caption?: string
): Promise<void> {
  const mediaId = await uploadWhatsappMedia(phoneNumberId, accessToken, imageBuffer);

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "image",
    image: { id: mediaId, caption: caption ?? "" },
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
    logger.error({ status: response.status, error }, "Failed to send WhatsApp image");
    throw new Error(`WhatsApp image send error: ${response.status}`);
  }

  logger.info({ to, phoneNumberId }, "WhatsApp image sent");
}
