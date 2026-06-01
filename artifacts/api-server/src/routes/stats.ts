import { Router, type IRouter } from "express";
import { eq, count, sql, inArray, and, gte } from "drizzle-orm";
import { db, businessesTable, whatsappConversationsTable, whatsappMessagesTable } from "@workspace/db";
import { GetBusinessStatsParams, GetBusinessStatsResponse, GetDashboardStatsResponse } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth-middleware";

const router: IRouter = Router();

router.get("/stats", requireAuth, async (req, res): Promise<void> => {
  const uid = req.user!.uid;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // All stats scoped to the logged-in user's businesses
  const userBusinessIds = await db
    .select({ id: businessesTable.id })
    .from(businessesTable)
    .where(eq(businessesTable.ownerUid, uid));

  const ids = userBusinessIds.map((b) => b.id);

  const [totalBusinesses] = await db
    .select({ count: count() })
    .from(businessesTable)
    .where(eq(businessesTable.ownerUid, uid));

  const [activeBusinesses] = await db
    .select({ count: count() })
    .from(businessesTable)
    .where(and(eq(businessesTable.ownerUid, uid), eq(businessesTable.isActive, true)));

  let totalConversations = 0;
  let totalMessages = 0;
  let messagesToday = 0;
  let conversationsToday = 0;

  if (ids.length > 0) {
    const [tc] = await db
      .select({ count: count() })
      .from(whatsappConversationsTable)
      .where(inArray(whatsappConversationsTable.businessId, ids));
    totalConversations = tc?.count ?? 0;

    const convIds = await db
      .select({ id: whatsappConversationsTable.id })
      .from(whatsappConversationsTable)
      .where(inArray(whatsappConversationsTable.businessId, ids));

    const cids = convIds.map((c) => c.id);
    if (cids.length > 0) {
      const [tm] = await db
        .select({ count: count() })
        .from(whatsappMessagesTable)
        .where(inArray(whatsappMessagesTable.conversationId, cids));
      totalMessages = tm?.count ?? 0;

      const [mt] = await db
        .select({ count: count() })
        .from(whatsappMessagesTable)
        .where(and(inArray(whatsappMessagesTable.conversationId, cids), gte(whatsappMessagesTable.createdAt, today)));
      messagesToday = mt?.count ?? 0;
    }

    const [ct] = await db
      .select({ count: count() })
      .from(whatsappConversationsTable)
      .where(and(inArray(whatsappConversationsTable.businessId, ids), gte(whatsappConversationsTable.createdAt, today)));
    conversationsToday = ct?.count ?? 0;
  }

  res.json(
    GetDashboardStatsResponse.parse({
      totalBusinesses: totalBusinesses?.count ?? 0,
      activeBusinesses: activeBusinesses?.count ?? 0,
      totalConversations,
      totalMessages,
      messagesToday,
      conversationsToday,
    })
  );
});

router.get("/stats/businesses/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetBusinessStatsParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { id } = params.data;

  // Verify ownership
  const [business] = await db
    .select({ id: businessesTable.id })
    .from(businessesTable)
    .where(and(eq(businessesTable.id, id), eq(businessesTable.ownerUid, req.user!.uid)));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

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
