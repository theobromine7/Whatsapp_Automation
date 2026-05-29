import { Router, type IRouter } from "express";
import { eq, count, sql } from "drizzle-orm";
import { db, whatsappConversationsTable, whatsappMessagesTable, businessesTable } from "@workspace/db";
import {
  ListBusinessConversationsParams,
  ListBusinessConversationsResponse,
  ListConversationMessagesParams,
  ListConversationMessagesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// All conversations across all businesses (for inbox view)
router.get("/conversations/all", async (req, res): Promise<void> => {
  const rows = await db.execute(sql`
    SELECT
      wc.id,
      wc.business_id AS "businessId",
      b.name AS "businessName",
      wc.customer_phone AS "customerPhone",
      wc.customer_name AS "customerName",
      wc.updated_at AS "updatedAt",
      wc.created_at AS "createdAt",
      COUNT(wm.id)::int AS "messageCount",
      MAX(wm.created_at) AS "lastMessageAt",
      (SELECT content FROM whatsapp_messages WHERE conversation_id = wc.id ORDER BY created_at DESC LIMIT 1) AS "lastMessage"
    FROM whatsapp_conversations wc
    LEFT JOIN businesses b ON b.id = wc.business_id
    LEFT JOIN whatsapp_messages wm ON wm.conversation_id = wc.id
    GROUP BY wc.id, b.name
    ORDER BY MAX(wm.created_at) DESC NULLS LAST
    LIMIT 200
  `);
  res.json(rows.rows);
});

router.get("/businesses/:id/conversations", async (req, res): Promise<void> => {
  const params = ListBusinessConversationsParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conversations = await db
    .select()
    .from(whatsappConversationsTable)
    .where(eq(whatsappConversationsTable.businessId, params.data.id))
    .orderBy(sql`${whatsappConversationsTable.updatedAt} DESC`);

  const withCounts = await Promise.all(
    conversations.map(async (conv) => {
      const [msgCount] = await db
        .select({ count: count() })
        .from(whatsappMessagesTable)
        .where(eq(whatsappMessagesTable.conversationId, conv.id));

      const [lastMsg] = await db
        .select()
        .from(whatsappMessagesTable)
        .where(eq(whatsappMessagesTable.conversationId, conv.id))
        .orderBy(sql`${whatsappMessagesTable.createdAt} DESC`)
        .limit(1);

      return {
        ...conv,
        messageCount: msgCount?.count ?? 0,
        lastMessageAt: lastMsg?.createdAt ?? null,
      };
    })
  );

  res.json(ListBusinessConversationsResponse.parse(withCounts));
});

router.get("/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = ListConversationMessagesParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const messages = await db
    .select()
    .from(whatsappMessagesTable)
    .where(eq(whatsappMessagesTable.conversationId, params.data.id))
    .orderBy(whatsappMessagesTable.createdAt);

  res.json(ListConversationMessagesResponse.parse(messages));
});

export default router;
