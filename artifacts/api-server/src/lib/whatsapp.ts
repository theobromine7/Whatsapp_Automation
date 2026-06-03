import { logger } from "./logger";

const GRAPH_API_VERSION = "v19.0";

// ─── Send text message ────────────────────────────────────────────────────────

export async function sendWhatsappMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  message: string
): Promise<void> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body: message, preview_url: false },
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
    throw new Error(`WhatsApp API error: ${response.status} — ${error}`);
  }

  logger.info({ to, phoneNumberId }, "WhatsApp message sent");
}

// ─── Mark message as read ─────────────────────────────────────────────────────

export async function markMetaMessageAsRead(
  phoneNumberId: string,
  accessToken: string,
  messageId: string
): Promise<void> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });
  } catch (err) {
    // best-effort — never block message processing
    logger.warn({ err, messageId }, "Failed to mark message as read");
  }
}

// ─── Download media from Meta CDN ─────────────────────────────────────────────

export async function downloadMetaMedia(
  mediaId: string,
  accessToken: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  // Step 1: get the download URL
  const metaRes = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!metaRes.ok) throw new Error(`Meta media lookup failed: ${metaRes.status}`);
  const meta = await metaRes.json() as { url: string; mime_type: string };

  // Step 2: download the binary
  const dlRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!dlRes.ok) throw new Error(`Meta media download failed: ${dlRes.status}`);

  const arrayBuffer = await dlRes.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), mimeType: meta.mime_type };
}

// ─── Upload media + send image ────────────────────────────────────────────────

async function uploadWhatsappMedia(
  phoneNumberId: string,
  accessToken: string,
  imageBuffer: Buffer,
  mimeType = "image/png"
): Promise<string> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/media`;

  const formData = new FormData();
  formData.append("messaging_product", "whatsapp");
  formData.append("type", mimeType);
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: mimeType });
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

export async function sendWhatsappImage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  imageBuffer: Buffer,
  caption?: string
): Promise<void> {
  const mediaId = await uploadWhatsappMedia(phoneNumberId, accessToken, imageBuffer);

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
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
