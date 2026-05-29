import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, broadcastsTable, whatsappConversationsTable, businessesTable } from "@workspace/db";
import { broadcastToRecentCustomers, buildProductBroadcastMessage } from "../lib/broadcast";

const router: IRouter = Router();

function parseId(val: unknown): number | null {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : null;
}

router.get("/businesses/:id/contacts", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid business id" });
    return;
  }

  const contacts = await db
    .selectDistinct({
      customerPhone: whatsappConversationsTable.customerPhone,
      customerName: whatsappConversationsTable.customerName,
      lastSeen: whatsappConversationsTable.updatedAt,
      firstSeen: whatsappConversationsTable.createdAt,
    })
    .from(whatsappConversationsTable)
    .where(eq(whatsappConversationsTable.businessId, id))
    .orderBy(desc(whatsappConversationsTable.updatedAt));

  res.json(contacts);
});

router.get("/businesses/:id/broadcasts", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid business id" });
    return;
  }

  const broadcasts = await db
    .select()
    .from(broadcastsTable)
    .where(eq(broadcastsTable.businessId, id))
    .orderBy(desc(broadcastsTable.createdAt));

  res.json(broadcasts);
});

router.post("/businesses/:id/broadcasts", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid business id" });
    return;
  }

  const { message } = req.body as Record<string, unknown>;
  if (typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const [business] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.id, id));

  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  const recipientCount = await broadcastToRecentCustomers(business, message.trim());

  const [broadcast] = await db
    .select()
    .from(broadcastsTable)
    .where(eq(broadcastsTable.businessId, id))
    .orderBy(desc(broadcastsTable.createdAt))
    .limit(1);

  res.status(201).json(broadcast ?? { businessId: id, message: message.trim(), recipientCount });
});

export default router;
