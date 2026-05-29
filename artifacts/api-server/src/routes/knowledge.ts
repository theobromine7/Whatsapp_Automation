import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, knowledgeChunksTable, businessesTable } from "@workspace/db";
import { embedText } from "@workspace/integrations-gemini-ai";

const router: IRouter = Router();

const VALID_SOURCE_TYPES = ["document", "faq", "product", "policy", "other"] as const;
type SourceType = typeof VALID_SOURCE_TYPES[number];

function parseId(val: unknown): number | null {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseChunkInput(body: unknown): { title: string; content: string; sourceType: SourceType } | null {
  if (!body || typeof body !== "object") return null;
  const { title, content, sourceType } = body as Record<string, unknown>;
  if (typeof title !== "string" || title.trim().length === 0 || title.length > 200) return null;
  if (typeof content !== "string" || content.trim().length === 0 || content.length > 10000) return null;
  if (!VALID_SOURCE_TYPES.includes(sourceType as SourceType)) return null;
  return { title: title.trim(), content: content.trim(), sourceType: sourceType as SourceType };
}

router.get("/businesses/:id/knowledge", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid business id" });
    return;
  }

  const chunks = await db
    .select({
      id: knowledgeChunksTable.id,
      businessId: knowledgeChunksTable.businessId,
      title: knowledgeChunksTable.title,
      content: knowledgeChunksTable.content,
      sourceType: knowledgeChunksTable.sourceType,
      createdAt: knowledgeChunksTable.createdAt,
    })
    .from(knowledgeChunksTable)
    .where(eq(knowledgeChunksTable.businessId, id))
    .orderBy(knowledgeChunksTable.createdAt);

  res.json(chunks);
});

router.post("/businesses/:id/knowledge", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid business id" });
    return;
  }

  const [business] = await db
    .select({ id: businessesTable.id })
    .from(businessesTable)
    .where(eq(businessesTable.id, id));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  const input = parseChunkInput(req.body);
  if (!input) {
    res.status(400).json({ error: "Invalid input: title, content, and sourceType are required" });
    return;
  }

  let embedding: number[] | undefined;
  try {
    embedding = await embedText(`${input.title}\n\n${input.content}`);
  } catch (err) {
    req.log?.warn({ err }, "Failed to generate embedding, storing chunk without it");
  }

  const [chunk] = await db
    .insert(knowledgeChunksTable)
    .values({
      businessId: id,
      title: input.title,
      content: input.content,
      sourceType: input.sourceType,
      embedding,
    })
    .returning({
      id: knowledgeChunksTable.id,
      businessId: knowledgeChunksTable.businessId,
      title: knowledgeChunksTable.title,
      content: knowledgeChunksTable.content,
      sourceType: knowledgeChunksTable.sourceType,
      createdAt: knowledgeChunksTable.createdAt,
    });

  res.status(201).json(chunk);
});

router.delete("/businesses/:id/knowledge/:chunkId", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const chunkId = parseId(req.params.chunkId);
  if (!id || !chunkId) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [deleted] = await db
    .delete(knowledgeChunksTable)
    .where(
      and(
        eq(knowledgeChunksTable.id, chunkId),
        eq(knowledgeChunksTable.businessId, id)
      )
    )
    .returning({ id: knowledgeChunksTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Knowledge chunk not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
