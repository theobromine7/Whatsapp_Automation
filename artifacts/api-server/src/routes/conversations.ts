import { Router, type IRouter } from "express";
import { eq, count, sql, and } from "drizzle-orm";
import { db, whatsappConversationsTable, whatsappMessagesTable, businessesTable } from "@workspace/db";
import { CONTACT_TAGS, AI_STATES } from "@workspace/db";
import {
  ListBusinessConversationsParams,
  ListBusinessConversationsResponse,
  ListConversationMessagesParams,
  ListConversationMessagesResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth-middleware";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// All conversations for inbox — scoped to the logged-in user's businesses
router.get("/conversations/all", requireAuth, async (req, res): Promise<void> => {
  const rows = await db.execute(sql`
    SELECT
      wc.id,
      wc.business_id AS "businessId",
      b.name AS "businessName",
      wc.customer_phone AS "customerPhone",
      wc.customer_name AS "customerName",
      wc.ai_state AS "aiState",
      wc.contact_type AS "contactType",
      wc.contact_tag AS "contactTag",
      wc.pending_human_review AS "pendingHumanReview",
      wc.last_detected_intent AS "lastDetectedIntent",
      wc.owner_last_message_at AS "ownerLastMessageAt",
      wc.updated_at AS "updatedAt",
      wc.created_at AS "createdAt",
      COUNT(wm.id)::int AS "messageCount",
      MAX(wm.created_at) AS "lastMessageAt",
      (SELECT content FROM whatsapp_messages WHERE conversation_id = wc.id ORDER BY created_at DESC LIMIT 1) AS "lastMessage"
    FROM whatsapp_conversations wc
    LEFT JOIN businesses b ON b.id = wc.business_id
    LEFT JOIN whatsapp_messages wm ON wm.conversation_id = wc.id
    WHERE b.owner_uid = ${req.user!.uid}
    GROUP BY wc.id, b.name, wc.ai_state, wc.contact_type, wc.contact_tag,
             wc.pending_human_review, wc.last_detected_intent, wc.owner_last_message_at
    ORDER BY wc.pending_human_review DESC, MAX(wm.created_at) DESC NULLS LAST
    LIMIT 200
  `);
  res.json(rows.rows);
});

// Set the AI state of a conversation (all 5 states accepted)
// Resuming AI (→ AI_ACTIVE) also clears any pending review flag
router.patch("/conversations/:id/ai-state", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid conversation ID" }); return; }

  const { aiState } = req.body as { aiState?: string };
  if (!aiState || !(AI_STATES as readonly string[]).includes(aiState)) {
    res.status(400).json({ error: `aiState must be one of: ${AI_STATES.join(", ")}` });
    return;
  }

  const [conv] = await db
    .select({ businessId: whatsappConversationsTable.businessId })
    .from(whatsappConversationsTable)
    .where(eq(whatsappConversationsTable.id, id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const [business] = await db
    .select({ id: businessesTable.id })
    .from(businessesTable)
    .where(and(eq(businessesTable.id, conv.businessId), eq(businessesTable.ownerUid, req.user!.uid)));
  if (!business) { res.status(403).json({ error: "Access denied" }); return; }

  // Clear pendingHumanReview whenever AI is being resumed
  const extraFields = aiState === "AI_ACTIVE" || aiState === "NEW_LEAD"
    ? { pendingHumanReview: false }
    : {};

  await db
    .update(whatsappConversationsTable)
    .set({ aiState: aiState as any, ...extraFields })
    .where(eq(whatsappConversationsTable.id, id));

  res.json({ id, aiState });
});

// Dismiss the pending human review flag for a conversation
router.patch("/conversations/:id/dismiss-review", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid conversation ID" }); return; }

  const [conv] = await db
    .select({ businessId: whatsappConversationsTable.businessId })
    .from(whatsappConversationsTable)
    .where(eq(whatsappConversationsTable.id, id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const [business] = await db
    .select({ id: businessesTable.id })
    .from(businessesTable)
    .where(and(eq(businessesTable.id, conv.businessId), eq(businessesTable.ownerUid, req.user!.uid)));
  if (!business) { res.status(403).json({ error: "Access denied" }); return; }

  await db
    .update(whatsappConversationsTable)
    .set({ pendingHumanReview: false })
    .where(eq(whatsappConversationsTable.id, id));

  res.json({ id, pendingHumanReview: false });
});

// Set a manual contact tag
router.patch("/conversations/:id/contact-tag", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid conversation ID" }); return; }

  const { contactTag } = req.body as { contactTag?: string | null };
  if (contactTag !== null && contactTag !== undefined && !(CONTACT_TAGS as readonly string[]).includes(contactTag)) {
    res.status(400).json({ error: `contactTag must be one of: ${CONTACT_TAGS.join(", ")} or null` });
    return;
  }

  const [conv] = await db
    .select({ businessId: whatsappConversationsTable.businessId })
    .from(whatsappConversationsTable)
    .where(eq(whatsappConversationsTable.id, id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const [business] = await db
    .select({ id: businessesTable.id })
    .from(businessesTable)
    .where(and(eq(businessesTable.id, conv.businessId), eq(businessesTable.ownerUid, req.user!.uid)));
  if (!business) { res.status(403).json({ error: "Access denied" }); return; }

  const [updated] = await db
    .update(whatsappConversationsTable)
    .set({ contactTag: (contactTag ?? null) as any })
    .where(eq(whatsappConversationsTable.id, id))
    .returning();

  res.json({ id, contactTag: updated?.contactTag ?? null });
});

router.get("/businesses/:id/conversations", requireAuth, async (req, res): Promise<void> => {
  const params = ListBusinessConversationsParams.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [business] = await db
    .select({ id: businessesTable.id })
    .from(businessesTable)
    .where(and(eq(businessesTable.id, params.data.id), eq(businessesTable.ownerUid, req.user!.uid)));
  if (!business) { res.status(404).json({ error: "Business not found" }); return; }

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
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [conv] = await db
    .select({ businessId: whatsappConversationsTable.businessId })
    .from(whatsappConversationsTable)
    .where(eq(whatsappConversationsTable.id, params.data.id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const [business] = await db
    .select({ id: businessesTable.id })
    .from(businessesTable)
    .where(and(eq(businessesTable.id, conv.businessId), eq(businessesTable.ownerUid, req.user!.uid)));
  if (!business) { res.status(403).json({ error: "Access denied" }); return; }

  const messages = await db
    .select()
    .from(whatsappMessagesTable)
    .where(eq(whatsappMessagesTable.conversationId, params.data.id))
    .orderBy(whatsappMessagesTable.createdAt);

  res.json(ListConversationMessagesResponse.parse(messages));
});

// Owner sends a message from the dashboard — sets OWNER_TAKEN_OVER, clears review flag
router.post("/conversations/:id/owner-message", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid conversation ID" }); return; }

  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) { res.status(400).json({ error: "text is required" }); return; }

  const [conv] = await db
    .select()
    .from(whatsappConversationsTable)
    .where(eq(whatsappConversationsTable.id, id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const [business] = await db
    .select()
    .from(businessesTable)
    .where(and(eq(businessesTable.id, conv.businessId), eq(businessesTable.ownerUid, req.user!.uid)));
  if (!business) { res.status(403).json({ error: "Access denied" }); return; }

  await db
    .update(whatsappConversationsTable)
    .set({ aiState: "OWNER_TAKEN_OVER", ownerLastMessageAt: new Date(), pendingHumanReview: false })
    .where(eq(whatsappConversationsTable.id, id));

  const [message] = await db
    .insert(whatsappMessagesTable)
    .values({ conversationId: id, role: "owner", content: text })
    .returning();

  setImmediate(async () => {
    try {
      if (business.connectionType === "meta_cloud" && business.whatsappPhoneNumberId && business.whatsappAccessToken) {
        const { sendWhatsappMessage } = await import("../lib/whatsapp");
        await sendWhatsappMessage(business.whatsappPhoneNumberId, business.whatsappAccessToken, conv.customerPhone, text);
      } else if (business.connectionType === "qr_session") {
        const { sendMessageViaSession } = await import("../lib/session-manager");
        await sendMessageViaSession(business.id, conv.customerJid ?? conv.customerPhone, text);
      }
    } catch (err) {
      logger.warn({ err, businessId: business.id, conversationId: id }, "Owner WhatsApp dispatch failed (non-fatal)");
    }
  });

  res.status(201).json(message);
});

export default router;
