import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, businessesTable } from "@workspace/db";
import {
  handleIncomingMessage,
  findBusinessByMetaPhoneId,
  metaSendReply,
  metaSendImage,
} from "../lib/message-handler";
import {
  markMetaMessageAsRead,
  downloadMetaMedia,
} from "../lib/whatsapp";
import { logger } from "../lib/logger";
import type { Business } from "@workspace/db";

const router: IRouter = Router();

// ─── Webhook verification (GET) ───────────────────────────────────────────────

router.get("/whatsapp/webhook", async (req, res): Promise<void> => {
  const mode = req.query["hub.mode"] as string;
  const token = req.query["hub.verify_token"] as string;
  const challenge = req.query["hub.challenge"] as string;

  if (mode !== "subscribe") {
    res.status(403).json({ error: "Invalid mode" });
    return;
  }

  // Search ALL businesses — isActive may still be false during initial Meta setup
  const businesses = await db.select().from(businessesTable);

  const matching = businesses.find((b) => b.webhookVerifyToken === token);

  if (!matching) {
    req.log.warn({ token }, "Webhook verification failed — no matching business");
    res.status(403).json({ error: "Verification token mismatch" });
    return;
  }

  req.log.info({ businessId: matching.id }, "Webhook verified");
  res.status(200).send(challenge);
});

// ─── Extract human-readable text from any Meta message type ──────────────────

interface MetaMessage {
  id: string;
  from: string;
  type: string;
  timestamp: string;
  text?: { body: string };
  image?: { id: string; caption?: string; mime_type?: string };
  audio?: { id: string; mime_type?: string; voice?: boolean };
  video?: { id: string; caption?: string; mime_type?: string };
  document?: { id: string; filename?: string; caption?: string; mime_type?: string };
  sticker?: { id: string; mime_type?: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  contacts?: Array<{ name?: { formatted_name?: string }; phones?: Array<{ phone?: string }> }>;
  interactive?: {
    type: "button_reply" | "list_reply";
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  button?: { text: string; payload?: string };
  reaction?: { message_id: string; emoji: string };
  order?: {
    catalog_id: string;
    text?: string;
    product_items?: Array<{ product_retailer_id: string; quantity: number; item_price: number; currency: string }>;
  };
}

interface MetaContact {
  profile?: { name?: string };
  wa_id?: string;
}

async function extractMessageContent(
  message: MetaMessage,
  business: Business
): Promise<{ text: string; mediaBuffer?: Buffer; mediaMime?: string } | null> {
  switch (message.type) {
    case "text":
      return { text: message.text?.body ?? "" };

    case "image": {
      const caption = message.image?.caption ? ` (caption: "${message.image.caption}")` : "";
      const text = `[📷 Customer sent a photo${caption}]`;
      // Download image to pass to AI vision or save in chat
      if (message.image?.id && business.whatsappAccessToken) {
        try {
          const { buffer, mimeType } = await downloadMetaMedia(
            message.image.id,
            business.whatsappAccessToken
          );
          return { text, mediaBuffer: buffer, mediaMime: mimeType };
        } catch (err) {
          logger.warn({ err, mediaId: message.image.id }, "Failed to download incoming image");
        }
      }
      return { text };
    }

    case "audio":
    case "voice": {
      const isVoice = message.audio?.voice === true || message.type === "voice";
      return { text: isVoice ? "[🎵 Customer sent a voice message]" : "[🎵 Customer sent an audio file]" };
    }

    case "video": {
      const caption = message.video?.caption ? ` (caption: "${message.video.caption}")` : "";
      return { text: `[🎥 Customer sent a video${caption}]` };
    }

    case "document": {
      const filename = message.document?.filename ? ` "${message.document.filename}"` : "";
      const caption = message.document?.caption ? ` — "${message.document.caption}"` : "";
      return { text: `[📄 Customer sent a document${filename}${caption}]` };
    }

    case "sticker":
      // Stickers don't warrant an AI reply — skip
      return null;

    case "location": {
      const loc = message.location!;
      const name = loc.name ? ` (${loc.name})` : "";
      const address = loc.address ? `, ${loc.address}` : "";
      return {
        text: `[📍 Customer shared location: ${loc.latitude}, ${loc.longitude}${name}${address}]`,
      };
    }

    case "contacts": {
      const first = message.contacts?.[0];
      const name = first?.name?.formatted_name ?? "a contact";
      const phone = first?.phones?.[0]?.phone ?? "";
      return { text: `[👤 Customer shared contact: ${name}${phone ? ` (${phone})` : ""}]` };
    }

    case "interactive": {
      const interactive = message.interactive!;
      if (interactive.type === "button_reply" && interactive.button_reply) {
        return { text: interactive.button_reply.title };
      }
      if (interactive.type === "list_reply" && interactive.list_reply) {
        const desc = interactive.list_reply.description
          ? ` — ${interactive.list_reply.description}`
          : "";
        return { text: `${interactive.list_reply.title}${desc}` };
      }
      return { text: "[Customer interacted with a menu]" };
    }

    case "button":
      return { text: message.button?.text ?? message.button?.payload ?? "[Button clicked]" };

    case "order": {
      const order = message.order!;
      const items = (order.product_items ?? [])
        .map((p) => `${p.product_retailer_id} x${p.quantity} @ ${p.currency} ${p.item_price}`)
        .join(", ");
      const note = order.text ? ` — "${order.text}"` : "";
      return { text: `[🛒 Customer placed an order${note}: ${items || "see catalog"}]` };
    }

    case "reaction":
      // Reactions don't need a reply
      return null;

    default:
      logger.info({ type: message.type }, "Unknown Meta message type — skipping");
      return null;
  }
}

// ─── Incoming webhook (POST) ──────────────────────────────────────────────────

router.post("/whatsapp/webhook", async (req, res): Promise<void> => {
  const body = req.body;

  if (body.object !== "whatsapp_business_account") {
    res.sendStatus(200);
    return;
  }

  // Always respond 200 immediately so Meta doesn't retry
  res.sendStatus(200);

  try {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;

        const value = change.value;
        const phoneNumberId: string = value?.metadata?.phone_number_id;

        // Handle delivery/read status updates — just log, don't process
        const statuses = value?.statuses ?? [];
        if (statuses.length > 0) {
          logger.info({ phoneNumberId, count: statuses.length }, "Meta status updates received");
          continue;
        }

        const messages: MetaMessage[] = value?.messages ?? [];
        const contacts: MetaContact[] = value?.contacts ?? [];

        for (const message of messages) {
          const customerPhone: string = message.from;
          const customerName: string =
            contacts.find((c) => c.wa_id === customerPhone)?.profile?.name ??
            contacts[0]?.profile?.name ??
            "";

          const business = await findBusinessByMetaPhoneId(phoneNumberId);
          if (!business) {
            logger.warn(
              { phoneNumberId },
              "No active Meta Cloud business found for phone number ID"
            );
            continue;
          }

          // Mark as read (best-effort)
          if (business.whatsappPhoneNumberId && business.whatsappAccessToken) {
            markMetaMessageAsRead(
              business.whatsappPhoneNumberId,
              business.whatsappAccessToken,
              message.id
            ).catch(() => {/* best-effort */});
          }

          const content = await extractMessageContent(message, business);
          if (!content) {
            logger.info(
              { type: message.type, customerPhone },
              "Message type skipped (sticker/reaction/etc)"
            );
            continue;
          }

          if (!content.text && !content.mediaBuffer) {
            logger.warn({ type: message.type }, "Empty content extracted — skipping");
            continue;
          }

          await handleIncomingMessage({
            business,
            customerPhone,
            customerName: customerName || null,
            messageText: content.text,
            whatsappMessageId: message.id,
            sendReply: (text) => metaSendReply(business, customerPhone, text),
            sendImage: (buf, caption) => metaSendImage(business, customerPhone, buf, caption),
          });
        }
      }
    }
  } catch (error) {
    logger.error({ error }, "Error processing webhook");
  }
});

export default router;
