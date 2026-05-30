import { eq, and } from "drizzle-orm";
import { db, businessesTable, whatsappConversationsTable, whatsappMessagesTable } from "@workspace/db";
import { generateAIResponse } from "./agent";
import { sendWhatsappMessage } from "./whatsapp";
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
}): Promise<void> {
  const { business, customerPhone, customerJid, customerName, messageText, whatsappMessageId, sendReply } = opts;

  // Upsert conversation — create if first contact, update name/jid if newly known
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

  // Save the incoming customer message
  await db.insert(whatsappMessagesTable).values({
    conversationId: conversation.id,
    role: "user",
    content: messageText,
    whatsappMessageId: whatsappMessageId ?? null,
  });

  // Mark conversation as active NOW — before AI generation so the contact
  // stays "recent" even if the AI call fails (e.g. rate limits)
  await db
    .update(whatsappConversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(whatsappConversationsTable.id, conversation.id));

  // Generate AI response — fall back to a friendly message on error
  let aiResponse: string;
  try {
    aiResponse = await generateAIResponse(business, conversation.id, messageText);
  } catch (err) {
    logger.error({ err, businessId: business.id }, "AI response generation failed");
    aiResponse = "Thanks for your message! We're experiencing a brief technical issue and will get back to you shortly.";
  }

  await db.insert(whatsappMessagesTable).values({
    conversationId: conversation.id,
    role: "assistant",
    content: aiResponse,
  });

  await sendReply(aiResponse);

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
