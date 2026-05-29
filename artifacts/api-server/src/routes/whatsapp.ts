import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, businessesTable } from "@workspace/db";
import { handleIncomingMessage, findBusinessByMetaPhoneId, metaSendReply } from "../lib/message-handler";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/whatsapp/webhook", async (req, res): Promise<void> => {
  const mode = req.query["hub.mode"] as string;
  const token = req.query["hub.verify_token"] as string;
  const challenge = req.query["hub.challenge"] as string;

  if (mode !== "subscribe") {
    res.status(403).json({ error: "Invalid mode" });
    return;
  }

  const businesses = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.isActive, true));

  const matching = businesses.find((b) => b.webhookVerifyToken === token);

  if (!matching) {
    req.log.warn({ token }, "Webhook verification failed — no matching business");
    res.status(403).json({ error: "Verification token mismatch" });
    return;
  }

  req.log.info({ businessId: matching.id }, "Webhook verified");
  res.status(200).send(challenge);
});

router.post("/whatsapp/webhook", async (req, res): Promise<void> => {
  const body = req.body;

  if (body.object !== "whatsapp_business_account") {
    res.sendStatus(200);
    return;
  }

  res.sendStatus(200);

  try {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;

        const value = change.value;
        const phoneNumberId: string = value?.metadata?.phone_number_id;
        const messages = value?.messages ?? [];

        for (const message of messages) {
          if (message.type !== "text") continue;

          const customerPhone: string = message.from;
          const customerName: string = value?.contacts?.[0]?.profile?.name ?? "";
          const messageText: string = message.text?.body ?? "";
          const whatsappMessageId: string = message.id;

          const business = await findBusinessByMetaPhoneId(phoneNumberId);
          if (!business) {
            logger.warn({ phoneNumberId }, "No active Meta Cloud business found for phone number ID");
            continue;
          }

          await handleIncomingMessage({
            business,
            customerPhone,
            customerName: customerName || null,
            messageText,
            whatsappMessageId,
            sendReply: (text) => metaSendReply(business, customerPhone, text),
          });
        }
      }
    }
  } catch (error) {
    logger.error({ error }, "Error processing webhook");
  }
});

export default router;
