import { Router, type IRouter } from "express";
import { eq, count, sql, and } from "drizzle-orm";
import { db, whatsappConversationsTable, whatsappMessagesTable, businessesTable } from "@workspace/db";
import {
  ListBusinessConversationsParams,
  ListBusinessConversationsResponse,
  ListConversationMessagesParams,
  ListConversationMessagesResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth-middleware";

const router: IRouter = Router();

// All conversations scoped to the logged-in user's businesses (for inbox view)
router.get("/conversations/all", requireAuth, async (req, res): Promise<void> => {
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
    WHERE b.owner_uid = ${req.user!.uid}
    GROUP BY wc.id, b.name
    ORDER BY MAX(wm.created_at) DESC NULLS LAST
    LIMIT 200
  `);
  res.json(rows.rows);
});

router.get("/businesses/:id/conversations", requireAuth, async (req, res): Promise<void> => {
  const params = ListBusinessConversationsParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Verify ownership
  const [business] = await db
    .select({ id: businessesTable.id })
    .from(businessesTable)
    .where(and(eq(businessesTable.id, params.data.id), eq(businessesTable.ownerUid, req.user!.uid)));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
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

router.get("/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const params = ListConversationMessagesParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Verify the conversation belongs to one of this user's businesses
  const [conv] = await db
    .select({ businessId: whatsappConversationsTable.businessId })
    .from(whatsappConversationsTable)
    .where(eq(whatsappConversationsTable.id, params.data.id));

  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const [business] = await db
    .select({ id: businessesTable.id })
    .from(businessesTable)
    .where(and(eq(businessesTable.id, conv.businessId), eq(businessesTable.ownerUid, req.user!.uid)));

  if (!business) {
    res.status(403).json({ error: "Access denied" });
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
