import { eq, and } from "drizzle-orm";
import { db, businessesTable, whatsappConversationsTable, whatsappMessagesTable } from "@workspace/db";
import { generateAIResponse, isWithinBusinessHours } from "./agent";
import { sendWhatsappMessage, sendWhatsappImage } from "./whatsapp";
import { generateUpiQr } from "./upi";
import { logger } from "./logger";
import { classifyContact, initialAiStateFromContactType, shouldAutoReply, isLowValueMessage } from "./lead-classifier";
import type { Business } from "@workspace/db";

const CONFIDENCE_THRESHOLD = 0.80;

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

  // ── Upsert conversation ───────────────────────────────────────────────────
  let [conversation] = await db
    .select()
    .from(whatsappConversationsTable)
    .where(
      and(
        eq(whatsappConversationsTable.businessId, business.id),
        eq(whatsappConversationsTable.customerPhone, customerPhone)
      )
    );

  const isFirstMessage = !conversation;

  if (!conversation) {
    const [newConv] = await db
      .insert(whatsappConversationsTable)
      .values({
        businessId: business.id,
        customerPhone,
        customerJid: customerJid ?? null,
        customerName,
        aiState: "NEW_LEAD",
      })
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

  // ── Lead Classification (first message only) ──────────────────────────────
  let { contactType } = conversation;
  if (!contactType) {
    contactType = await classifyContact(messageText, customerName);
    const derivedState = initialAiStateFromContactType(contactType);
    const stateUpdate =
      conversation.aiState === "NEW_LEAD"
        ? { contactType, aiState: derivedState }
        : { contactType };

    await db
      .update(whatsappConversationsTable)
      .set(stateUpdate)
      .where(eq(whatsappConversationsTable.id, conversation.id));

    conversation = { ...conversation, contactType, aiState: stateUpdate.aiState ?? conversation.aiState } as typeof conversation;

    logger.info(
      { businessId: business.id, conversationId: conversation.id, customerPhone, contactType, aiState: conversation.aiState },
      "Contact classified"
    );
  }

  // ── Conversation State Guard ──────────────────────────────────────────────
  if (!shouldAutoReply(conversation.aiState)) {
    logger.info(
      { businessId: business.id, conversationId: conversation.id, aiState: conversation.aiState },
      `AI reply suppressed — state: ${conversation.aiState}`
    );
    return;
  }

  // ── Contact Tag Guard — manual override always wins ───────────────────────
  const BLOCKED_CONTACT_TAGS = new Set(["PERSONAL", "FAMILY", "STAFF", "SUPPLIER"]);
  if (conversation.contactTag && BLOCKED_CONTACT_TAGS.has(conversation.contactTag)) {
    logger.info(
      { businessId: business.id, conversationId: conversation.id, contactTag: conversation.contactTag },
      `AI reply suppressed — contact tag: ${conversation.contactTag}`
    );
    // Sync aiState so future messages don't need this check
    await db
      .update(whatsappConversationsTable)
      .set({ aiState: "PERSONAL_CONTACT" })
      .where(eq(whatsappConversationsTable.id, conversation.id));
    return;
  }

  // ── Intent Filter — skip low-value acknowledgements ───────────────────────
  // Never suppress on first message — a "hey" from a new contact is a valid opener.
  if (!isFirstMessage && isLowValueMessage(messageText)) {
    logger.info(
      { businessId: business.id, conversationId: conversation.id, messageText },
      "Low-value message — AI reply suppressed"
    );
    return;
  }

  // ── Business Hours Context ────────────────────────────────────────────────
  const withinHours = isWithinBusinessHours(business.businessHours);
  logger.info(
    { businessId: business.id, conversationId: conversation.id, withinHours },
    "Business hours check"
  );

  // Generate AI response (includes confidence score + intent)
  let aiResult: Awaited<ReturnType<typeof generateAIResponse>>;
  try {
    aiResult = await generateAIResponse(business, conversation.id, messageText);
  } catch (err) {
    logger.error({ err, businessId: business.id }, "AI response generation failed");
    const fallback = `Hi! Thanks for reaching out to ${business.name ?? "us"}. We received your message and will respond shortly! 😊`;
    await db.insert(whatsappMessagesTable).values({ conversationId: conversation.id, role: "assistant", content: fallback });
    await sendReply(fallback);
    return;
  }

  logger.info(
    { businessId: business.id, conversationId: conversation.id, intent: aiResult.intent, confidence: aiResult.confidence },
    "AI response generated"
  );

  // ── Confidence Check (Feature 7) ──────────────────────────────────────────
  // Outside business hours, confidence threshold is relaxed — AI always handles.
  const effectiveThreshold = withinHours ? CONFIDENCE_THRESHOLD : 0.50;

  if (aiResult.confidence < effectiveThreshold) {
    logger.info(
      { businessId: business.id, conversationId: conversation.id, confidence: aiResult.confidence, threshold: effectiveThreshold, intent: aiResult.intent },
      "Low-confidence response — marking for human review"
    );
    await db
      .update(whatsappConversationsTable)
      .set({
        pendingHumanReview: true,
        lastDetectedIntent: aiResult.intent,
        updatedAt: new Date(),
      })
      .where(eq(whatsappConversationsTable.id, conversation.id));
    return;
  }

  // ── Save and send AI reply ────────────────────────────────────────────────
  await db.insert(whatsappMessagesTable).values({
    conversationId: conversation.id,
    role: "assistant",
    content: aiResult.text,
  });

  // Clear any pending review flag when AI successfully replies
  const stateTransition = conversation.aiState === "NEW_LEAD" ? "AI_ACTIVE" : conversation.aiState;
  await db
    .update(whatsappConversationsTable)
    .set({
      aiState: stateTransition,
      pendingHumanReview: false,
      lastDetectedIntent: aiResult.intent,
      updatedAt: new Date(),
    })
    .where(eq(whatsappConversationsTable.id, conversation.id));

  await sendReply(aiResult.text);

  // If purchase intent + UPI configured → send QR code
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
    { businessId: business.id, conversationId: conversation.id, customerPhone, intent: aiResult.intent, confidence: aiResult.confidence },
    "Message handled and reply sent"
  );
}

/**
 * Called when the business owner sends a message (fromMe).
 * Sets OWNER_TAKEN_OVER and clears any pending review flag.
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
      "Human takeover — AI silenced"
    );
  }

  await db
    .update(whatsappConversationsTable)
    .set({ aiState: "OWNER_TAKEN_OVER", ownerLastMessageAt: new Date(), pendingHumanReview: false })
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
