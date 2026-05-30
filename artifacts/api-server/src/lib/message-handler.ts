import { eq, and } from "drizzle-orm";
import { db, businessesTable, whatsappConversationsTable, whatsappMessagesTable } from "@workspace/db";
import { generateAIResponse } from "./agent";
import { sendWhatsappMessage, sendWhatsappImage } from "./whatsapp";
import { generateUpiQr } from "./upi";
import { logger } from "./logger";
import type { Business } from "@workspace/db";

export async function handleIncomingMessage(opts: {
  business: Business;
  customerPhone: string;
  customerJid?: string;
  customerName: string | null;
  messageText: string;
  whatsappMessageId?: string;
  sendReply: (text: string) => Promise<void>;
  sendImage?: (imageBuffer: Buffer, caption?: string) => Promise<void>;
}): Promise<void> {
  const { business, customerPhone, customerJid, customerName, messageText, whatsappMessageId, sendReply, sendImage } = opts;

  // Upsert conversation
  let [conversation] = await db
    .select()
    .from(whatsappConversationsTable)
    .where(
      and(
        eq(whatsappConversationsTable.businessId, business.id),
        eq(whatsappConversationsTable.customerPhone, customerPhone)
      )
    );

  if (!conversation) {
    const [newConv] = await db
      .insert(whatsappConversationsTable)
      .values({ businessId: business.id, customerPhone, customerJid: customerJid ?? null, customerName })
      .returning();
    conversation = newConv!;
  } else {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (customerName && !conversation.customerName) updates.customerName = customerName;
    if (customerJid && !conversation.customerJid) updates.customerJid = customerJid;
    if (Object.keys(updates).length > 1 || !conversation.customerName) {
      await db
        .update(whatsappConversationsTable)
        .set(updates)
        .where(eq(whatsappConversationsTable.id, conversation.id));
    }
  }

  // Save incoming customer message
  await db.insert(whatsappMessagesTable).values({
    conversationId: conversation.id,
    role: "user",
    content: messageText,
    whatsappMessageId: whatsappMessageId ?? null,
  });

  // Mark conversation as active
  await db
    .update(whatsappConversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(whatsappConversationsTable.id, conversation.id));

  // Generate AI response
  let aiResult: Awaited<ReturnType<typeof generateAIResponse>>;
  try {
    aiResult = await generateAIResponse(business, conversation.id, messageText);
  } catch (err) {
    logger.error({ err, businessId: business.id }, "AI response generation failed");
    const fallback = "Thanks for your message! We're experiencing a brief technical issue and will get back to you shortly.";
    await db.insert(whatsappMessagesTable).values({ conversationId: conversation.id, role: "assistant", content: fallback });
    await sendReply(fallback);
    return;
  }

  // Save AI text response
  await db.insert(whatsappMessagesTable).values({
    conversationId: conversation.id,
    role: "assistant",
    content: aiResult.text,
  });

  await sendReply(aiResult.text);

  // If purchase intent detected and store has UPI, send QR code
  if (aiResult.purchaseIntent && business.upiId && business.storeName) {
    try {
      const qrBuffer = await generateUpiQr({
        upiId: business.upiId,
        payeeName: business.storeName,
        amount: aiResult.detectedProductPrice,
        note: aiResult.detectedProductName
          ? `Payment for ${aiResult.detectedProductName}`
          : "Payment",
      });

      const caption = aiResult.detectedProductPrice
        ? `Scan to pay ₹${aiResult.detectedProductPrice} for ${aiResult.detectedProductName ?? "your order"}`
        : `Scan to pay — ${business.storeName}`;

      if (sendImage) {
        await sendImage(qrBuffer, caption);
        logger.info({ businessId: business.id, customerPhone }, "UPI QR sent");
      } else {
        // Fallback: for QR session we can't send images easily, send text UPI link
        const { buildUpiLink } = await import("./upi");
        const link = buildUpiLink({
          upiId: business.upiId,
          payeeName: business.storeName,
          amount: aiResult.detectedProductPrice,
          note: aiResult.detectedProductName ? `Payment for ${aiResult.detectedProductName}` : "Payment",
        });
        await sendReply(`💳 Pay via UPI: ${link}`);
      }
    } catch (err) {
      logger.warn({ err, businessId: business.id }, "Failed to send UPI QR — skipping");
    }
  }

  logger.info(
    { businessId: business.id, conversationId: conversation.id, customerPhone },
    "Message handled and reply sent"
  );
}

export async function findBusinessByMetaPhoneId(phoneNumberId: string): Promise<Business | null> {
  const [business] = await db
    .select()
    .from(businessesTable)
    .where(
      and(
        eq(businessesTable.whatsappPhoneNumberId, phoneNumberId),
        eq(businessesTable.isActive, true)
      )
    );
  return business ?? null;
}

export async function findBusinessByConnectedPhone(phone: string): Promise<Business | null> {
  const [business] = await db
    .select()
    .from(businessesTable)
    .where(
      and(
        eq(businessesTable.connectedPhone, phone),
        eq(businessesTable.isActive, true)
      )
    );
  return business ?? null;
}

export async function metaSendReply(business: Business, to: string, text: string): Promise<void> {
  if (!business.whatsappPhoneNumberId || !business.whatsappAccessToken) {
    throw new Error("Business does not have Meta Cloud API credentials");
  }
  await sendWhatsappMessage(business.whatsappPhoneNumberId, business.whatsappAccessToken, to, text);
}

export async function metaSendImage(business: Business, to: string, imageBuffer: Buffer, caption?: string): Promise<void> {
  if (!business.whatsappPhoneNumberId || !business.whatsappAccessToken) {
    throw new Error("Business does not have Meta Cloud API credentials");
  }
  await sendWhatsappImage(business.whatsappPhoneNumberId, business.whatsappAccessToken, to, imageBuffer, caption);
}
