import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, businessesTable, knowledgeChunksTable } from "@workspace/db";
import { embedText } from "@workspace/integrations-gemini-ai";
import { fetchStoreByOwner, fetchProductsByStoreId } from "../lib/firebase";
import { logger } from "../lib/logger";
import { requireAuth } from "../lib/auth-middleware";

const router: IRouter = Router();

const STORE_DOMAIN = "https://store.advize.in";

function parseId(val: unknown): number | null {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function buildProductContent(p: {
  id: string;
  name: string;
  description: string;
  price: number;
  sale_price?: number;
  category: string;
  product_type?: string;
  units?: number;
}, _storeSlug: string): string {
  const effectivePrice = p.sale_price && p.sale_price < p.price ? p.sale_price : p.price;
  const link = `${STORE_DOMAIN}/product/${p.id}`;

  let content = `Product: ${p.name}\n`;
  content += `Price: ₹${effectivePrice}`;
  if (p.sale_price && p.sale_price < p.price) content += ` (was ₹${p.price})`;
  content += `\nCategory: ${p.category}\n`;
  if (p.description) content += `Description: ${p.description}\n`;
  if (p.units !== undefined) content += `Stock: ${p.units > 0 ? `${p.units} units available` : "Out of stock"}\n`;
  content += `Link: ${link}`;
  return content;
}

// POST /businesses/:id/firebase-sync
// Body: { firebaseUid: string }
router.post("/businesses/:id/firebase-sync", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid business id" });
    return;
  }

  const [business] = await db
    .select()
    .from(businessesTable)
    .where(and(eq(businessesTable.id, id), eq(businessesTable.ownerUid, req.user!.uid)));

  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  const firebaseUid: string | undefined =
    typeof req.body?.firebaseUid === "string" && req.body.firebaseUid.trim()
      ? req.body.firebaseUid.trim()
      : business.firebaseUid ?? undefined;

  if (!firebaseUid) {
    res.status(400).json({ error: "firebaseUid is required" });
    return;
  }

  try {
    const store = await fetchStoreByOwner(firebaseUid);
    if (!store) {
      res.status(404).json({ error: `No store found for Firebase UID: ${firebaseUid}` });
      return;
    }

    const products = await fetchProductsByStoreId(store.id);

    // Save store linkage fields on the business
    await db
      .update(businessesTable)
      .set({
        firebaseUid,
        upiId: store.upi_id ?? business.upiId,
        storeSlug: store.slug,
        storeName: store.name,
        lastSyncedAt: new Date(),
      })
      .where(eq(businessesTable.id, id));

    // Delete old firebase-synced chunks (sourceType = 'product' or 'document' tagged with firebase)
    // We use a dedicated sourceType 'firebase_product' to avoid clobbering manual entries
    await db
      .delete(knowledgeChunksTable)
      .where(
        and(
          eq(knowledgeChunksTable.businessId, id),
          eq(knowledgeChunksTable.sourceType, "firebase_product")
        )
      );

    // Also re-sync the store info chunk
    await db
      .delete(knowledgeChunksTable)
      .where(
        and(
          eq(knowledgeChunksTable.businessId, id),
          eq(knowledgeChunksTable.sourceType, "firebase_store")
        )
      );

    // Insert store info chunk
    const storeUrl = store.slug
      ? `${STORE_DOMAIN}/store/${store.slug}`
      : STORE_DOMAIN;

    const storeContent = [
      `Store: ${store.name}`,
      store.category ? `Category: ${store.category}` : null,
      store.location ? `Location: ${store.location}` : null,
      store.delivery_charge ? `Delivery charge: ₹${store.delivery_charge}` : null,
      store.terms_and_conditions ? `Terms: ${store.terms_and_conditions}` : null,
      store.upi_id ? `UPI Payment ID: ${store.upi_id}` : null,
      `Store URL: ${storeUrl}`,
    ].filter(Boolean).join("\n");

    let storeEmbedding: number[] | undefined;
    try {
      storeEmbedding = await embedText(`${store.name} store info\n\n${storeContent}`);
    } catch { /* proceed without embedding */ }

    await db.insert(knowledgeChunksTable).values({
      businessId: id,
      title: `${store.name} — Store Info`,
      content: storeContent,
      sourceType: "firebase_store",
      embedding: storeEmbedding,
    });

    // Insert product chunks in batches with embeddings
    let synced = 0;
    for (const product of products) {
      const content = buildProductContent(product, store.slug);
      let embedding: number[] | undefined;
      try {
        embedding = await embedText(`${product.name}\n\n${content}`);
      } catch { /* proceed without embedding */ }

      await db.insert(knowledgeChunksTable).values({
        businessId: id,
        title: product.name,
        content,
        sourceType: "firebase_product",
        embedding,
      });
      synced++;
    }

    logger.info({ businessId: id, storeId: store.id, synced }, "Firebase sync complete");

    res.json({
      success: true,
      store: { id: store.id, name: store.name, slug: store.slug, upiId: store.upi_id },
      productssynced: synced,
      lastSyncedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err, businessId: id }, "Firebase sync failed");
    const message = err instanceof Error ? err.message : "Sync failed";
    res.status(500).json({ error: message });
  }
});

// GET /businesses/:id/firebase-sync — return current sync status
router.get("/businesses/:id/firebase-sync", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid business id" });
    return;
  }

  const [business] = await db
    .select({
      firebaseUid: businessesTable.firebaseUid,
      upiId: businessesTable.upiId,
      storeSlug: businessesTable.storeSlug,
      storeName: businessesTable.storeName,
      lastSyncedAt: businessesTable.lastSyncedAt,
    })
    .from(businessesTable)
    .where(and(eq(businessesTable.id, id), eq(businessesTable.ownerUid, req.user!.uid)));

  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  // Count synced chunks
  const chunks = await db
    .select({ sourceType: knowledgeChunksTable.sourceType })
    .from(knowledgeChunksTable)
    .where(
      and(
        eq(knowledgeChunksTable.businessId, id),
        eq(knowledgeChunksTable.sourceType, "firebase_product")
      )
    );

  res.json({
    firebaseUid: business.firebaseUid,
    upiId: business.upiId,
    storeSlug: business.storeSlug,
    storeName: business.storeName,
    lastSyncedAt: business.lastSyncedAt,
    syncedProductCount: chunks.length,
  });
});

export default router;
