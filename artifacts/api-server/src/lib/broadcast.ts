import { db, broadcastsTable, whatsappConversationsTable } from "@workspace/db";
import { eq, gte, and } from "drizzle-orm";
import { sendWhatsappMessage } from "./whatsapp";
import { logger } from "./logger";

export async function broadcastToRecentCustomers(
  business: {
    id: number;
    name: string;
    whatsappPhoneNumberId: string | null;
    whatsappAccessToken: string | null;
  },
  message: string,
  triggerChunkId?: number
): Promise<number> {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const customers = await db
    .selectDistinct({ customerPhone: whatsappConversationsTable.customerPhone })
    .from(whatsappConversationsTable)
    .where(
      and(
        eq(whatsappConversationsTable.businessId, business.id),
        gte(whatsappConversationsTable.updatedAt, threeMonthsAgo)
      )
    );

  let sent = 0;

  if (business.whatsappPhoneNumberId && business.whatsappAccessToken && customers.length > 0) {
    for (const { customerPhone } of customers) {
      try {
        await sendWhatsappMessage(
          business.whatsappPhoneNumberId,
          business.whatsappAccessToken,
          customerPhone,
          message
        );
        sent++;
      } catch (err) {
        logger.warn({ err, phone: customerPhone }, "Broadcast: failed to send to customer");
      }
    }
  }

  await db.insert(broadcastsTable).values({
    businessId: business.id,
    triggerChunkId: triggerChunkId ?? null,
    message,
    recipientCount: sent,
  });

  logger.info({ businessId: business.id, sent, total: customers.length }, "Broadcast completed");
  return sent;
}

export function buildProductBroadcastMessage(
  businessName: string,
  productTitle: string,
  productContent: string
): string {
  const snippet = productContent.length > 200 ? productContent.slice(0, 200).trimEnd() + "…" : productContent;
  return `Hi! ${businessName} has a new product available: *${productTitle}*\n\n${snippet}\n\nReply to this message to learn more!`;
}
