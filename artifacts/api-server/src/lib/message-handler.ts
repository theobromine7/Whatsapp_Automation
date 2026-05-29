import { eq, and } from "drizzle-orm";
import { db, businessesTable, whatsappConversationsTable, whatsappMessagesTable } from "@workspace/db";
import { generateAIResponse } from "./agent";
import { sendWhatsappMessage } from "./whatsapp";
import { logger } from "./logger";
import type { Business } from "@workspace/db";

export async function handleIncomingMessage(opts: {
  business: Business;
  customerPhone: string;
  customerName: string | null;
  messageText: string;
  whatsappMessageId?: string;
  sendReply: (text: string) => Promise<void>;
}): Promise<void> {
  const { business, customerPhone, customerName, messageText, whatsappMessageId, sendReply } = opts;

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
      .values({ businessId: business.id, customerPhone, customerName })
      .returning();
    conversation = newConv!;
  } else if (customerName && !conversation.customerName) {
    await db
      .update(whatsappConversationsTable)
      .set({ customerName, updatedAt: new Date() })
      .where(eq(whatsappConversationsTable.id, conversation.id));
  }

  await db.insert(whatsappMessagesTable).values({
    conversationId: conversation.id,
    role: "user",
    content: messageText,
    whatsappMessageId: whatsappMessageId ?? null,
  });

  const aiResponse = await generateAIResponse(business, conversation.id, messageText);

  await db.insert(whatsappMessagesTable).values({
    conversationId: conversation.id,
    role: "assistant",
    content: aiResponse,
  });

  await db
    .update(whatsappConversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(whatsappConversationsTable.id, conversation.id));

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
