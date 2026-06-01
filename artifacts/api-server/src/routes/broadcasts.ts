import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, broadcastsTable, whatsappConversationsTable, businessesTable } from "@workspace/db";
import { broadcastToRecentCustomers } from "../lib/broadcast";
import { requireAuth } from "../lib/auth-middleware";

const router: IRouter = Router();

function parseId(val: unknown): number | null {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function getOwnedBusiness(id: number, uid: string) {
  const [b] = await db
    .select()
    .from(businessesTable)
    .where(and(eq(businessesTable.id, id), eq(businessesTable.ownerUid, uid)));
  return b ?? null;
}

router.get("/businesses/:id/contacts", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid business id" }); return; }

  const business = await getOwnedBusiness(id, req.user!.uid);
  if (!business) { res.status(404).json({ error: "Business not found" }); return; }

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

router.get("/businesses/:id/broadcasts", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid business id" }); return; }

  const business = await getOwnedBusiness(id, req.user!.uid);
  if (!business) { res.status(404).json({ error: "Business not found" }); return; }

  const broadcasts = await db
    .select()
    .from(broadcastsTable)
    .where(eq(broadcastsTable.businessId, id))
    .orderBy(desc(broadcastsTable.createdAt));

  res.json(broadcasts);
});

router.post("/businesses/:id/broadcasts", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid business id" }); return; }

  const { message } = req.body as Record<string, unknown>;
  if (typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const business = await getOwnedBusiness(id, req.user!.uid);
  if (!business) { res.status(404).json({ error: "Business not found" }); return; }

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
