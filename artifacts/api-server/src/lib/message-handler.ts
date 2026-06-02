import { eq, and } from "drizzle-orm";
import { db, businessesTable, whatsappConversationsTable, whatsappMessagesTable } from "@workspace/db";
import { generateAIResponse } from "./agent";
import { sendWhatsappMessage, sendWhatsappImage } from "./whatsapp";
import { generateUpiQr } from "./upi";
import { logger } from "./logger";
import { classifyContact, shouldAutoReply } from "./lead-classifier";
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

  // ── Lead Classification ───────────────────────────────────────────────────
  // Classify on the first message (contactType not yet set) unless a manual
  // contactTag is already present (owner override takes full precedence).
  let contactType = conversation.contactType;
  if (!contactType && !conversation.contactTag) {
    contactType = await classifyContact(messageText, customerName);
    await db
      .update(whatsappConversationsTable)
      .set({ contactType })
      .where(eq(whatsappConversationsTable.id, conversation.id));
    logger.info(
      { businessId: business.id, conversationId: conversation.id, customerPhone, contactType },
      "Contact classified"
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── Conversation Control Guard ────────────────────────────────────────────
  // 1. Human takeover: owner manually replied — AI stays silent until 30-min auto-resume.
  if (conversation.aiState === "OWNER_TAKEN_OVER") {
    logger.info(
      { businessId: business.id, conversationId: conversation.id, customerPhone },
      "Conversation in OWNER_TAKEN_OVER state — AI reply suppressed"
    );
    return;
  }

  // 2. Contact filter: skip auto-reply for personal/family/staff/supplier contacts.
  if (!shouldAutoReply(contactType, conversation.contactTag)) {
    logger.info(
      { businessId: business.id, conversationId: conversation.id, customerPhone, contactType, contactTag: conversation.contactTag },
      "Contact type/tag not eligible for auto-reply — AI reply suppressed"
    );
    return;
  }
  // ─────────────────────────────────────────────────────────────────────────

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

/**
 * Called when the business owner sends a message from their WhatsApp (fromMe).
 * Sets the conversation's aiState to OWNER_TAKEN_OVER so the AI stays silent.
 * If no conversation exists yet (owner initiating), nothing is changed.
 */
export async function handleOwnerMessage(opts: {
  business: Business;
  customerJid: string;
}): Promise<void> {
  const customerPhone = opts.customerJid.split("@")[0].split(":")[0];

  const [conversation] = await db
    .select()
    .from(whatsappConversationsTable)
    .where(
      and(
        eq(whatsappConversationsTable.businessId, opts.business.id),
        eq(whatsappConversationsTable.customerPhone, customerPhone)
      )
    );

  if (!conversation) return;

  if (conversation.aiState !== "OWNER_TAKEN_OVER") {
    logger.info(
      { businessId: opts.business.id, conversationId: conversation.id, customerPhone },
      "Human takeover — AI silenced for this conversation"
    );
  }

  await db
    .update(whatsappConversationsTable)
    .set({ aiState: "OWNER_TAKEN_OVER", ownerLastMessageAt: new Date() })
    .where(eq(whatsappConversationsTable.id, conversation.id));
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
