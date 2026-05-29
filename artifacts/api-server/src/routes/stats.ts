import { Router, type IRouter } from "express";
import { eq, count, sql, inArray, and, gte } from "drizzle-orm";
import { db, businessesTable, whatsappConversationsTable, whatsappMessagesTable } from "@workspace/db";
import { GetBusinessStatsParams, GetBusinessStatsResponse, GetDashboardStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats", async (req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalBusinesses] = await db.select({ count: count() }).from(businessesTable);
  const [activeBusinesses] = await db
    .select({ count: count() })
    .from(businessesTable)
    .where(eq(businessesTable.isActive, true));
  const [totalConversations] = await db.select({ count: count() }).from(whatsappConversationsTable);
  const [totalMessages] = await db.select({ count: count() }).from(whatsappMessagesTable);
  const [messagesToday] = await db
    .select({ count: count() })
    .from(whatsappMessagesTable)
    .where(sql`${whatsappMessagesTable.createdAt} >= ${today}`);
  const [conversationsToday] = await db
    .select({ count: count() })
    .from(whatsappConversationsTable)
    .where(sql`${whatsappConversationsTable.createdAt} >= ${today}`);

  res.json(
    GetDashboardStatsResponse.parse({
      totalBusinesses: totalBusinesses?.count ?? 0,
      activeBusinesses: activeBusinesses?.count ?? 0,
      totalConversations: totalConversations?.count ?? 0,
      totalMessages: totalMessages?.count ?? 0,
      messagesToday: messagesToday?.count ?? 0,
      conversationsToday: conversationsToday?.count ?? 0,
    })
  );
});

router.get("/stats/businesses/:id", async (req, res): Promise<void> => {
  const params = GetBusinessStatsParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { id } = params.data;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [totalConversations] = await db
    .select({ count: count() })
    .from(whatsappConversationsTable)
    .where(eq(whatsappConversationsTable.businessId, id));

  const conversationIds = await db
    .select({ id: whatsappConversationsTable.id })
    .from(whatsappConversationsTable)
    .where(eq(whatsappConversationsTable.businessId, id));

  const ids = conversationIds.map((c) => c.id);

  let totalMessages = 0;
  let messagesThisWeek = 0;

  if (ids.length > 0) {
    const [tm] = await db
      .select({ count: count() })
      .from(whatsappMessagesTable)
      .where(inArray(whatsappMessagesTable.conversationId, ids));
    totalMessages = tm?.count ?? 0;

    const [mw] = await db
      .select({ count: count() })
      .from(whatsappMessagesTable)
      .where(and(inArray(whatsappMessagesTable.conversationId, ids), gte(whatsappMessagesTable.createdAt, weekAgo)));
    messagesThisWeek = mw?.count ?? 0;
  }

  const [activeCustomers] = await db
    .select({ count: count() })
    .from(whatsappConversationsTable)
    .where(
      sql`${whatsappConversationsTable.businessId} = ${id} AND ${whatsappConversationsTable.updatedAt} >= ${weekAgo}`
    );

  const recentConversations = await db
    .select()
    .from(whatsappConversationsTable)
    .where(eq(whatsappConversationsTable.businessId, id))
    .orderBy(sql`${whatsappConversationsTable.updatedAt} DESC`)
    .limit(5);

  const conversationsWithCount = await Promise.all(
    recentConversations.map(async (conv) => {
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

  res.json(
    GetBusinessStatsResponse.parse({
      totalConversations: totalConversations?.count ?? 0,
      totalMessages,
      messagesThisWeek,
      activeCustomers: activeCustomers?.count ?? 0,
      recentConversations: conversationsWithCount,
    })
  );
});

export default router;
