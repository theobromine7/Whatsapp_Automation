import { ai, embedText } from "@workspace/integrations-gemini-ai";
import { db, whatsappMessagesTable, knowledgeChunksTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { logger } from "./logger";
import type { Business } from "@workspace/db";

const PURCHASE_INTENT_KEYWORDS = [
  "buy", "purchase", "order", "payment", "pay", "how much", "price", "cost",
  "checkout", "want to get", "want to buy", "i'll take", "i want", "book",
  "खरीदना", "खरीदें", "ऑर्डर", "भुगतान", "कीमत", "order karna", "khareedna",
];

export interface AIResponseResult {
  text: string;
  purchaseIntent: boolean;
  detectedProductName?: string;
  detectedProductPrice?: number;
}

const MAX_HISTORY_MESSAGES = 20;
const RETRY_HISTORY_MESSAGES = 6;

export async function generateAIResponse(
  business: Business,
  conversationId: number,
  customerMessage: string
): Promise<AIResponseResult> {
  const systemPrompt = buildSystemPrompt(business);

  // Load last N messages only — prevents context overflow in long conversations
  const recentRows = await db
    .select()
    .from(whatsappMessagesTable)
    .where(eq(whatsappMessagesTable.conversationId, conversationId))
    .orderBy(desc(whatsappMessagesTable.createdAt))
    .limit(MAX_HISTORY_MESSAGES);

  // Reverse so oldest-first for the chat API
  const history = recentRows.reverse();

  const { ragContext, topProduct } = await retrieveRelevantChunks(business.id, customerMessage);

  const fullSystemPrompt = ragContext
    ? `${systemPrompt}\n\n${ragContext}`
    : systemPrompt;

  const paymentPrompt = business.upiId
    ? `\n\nPAYMENT: If a customer wants to buy something, tell them you will send them a payment QR code. UPI ID: ${business.upiId}`
    : "";

  const systemInstruction = fullSystemPrompt + paymentPrompt;

  const buildContents = (msgs: typeof history) => {
    const contents = msgs.map((msg) => ({
      role: msg.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: msg.content }],
    }));
    contents.push({ role: "user", parts: [{ text: customerMessage }] });
    return contents;
  };

  const callGemini = async (msgs: typeof history) => {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: buildContents(msgs),
      config: { systemInstruction, maxOutputTokens: 2048 },
    });
    return response.text ?? "I'm sorry, I couldn't generate a response. Please try again.";
  };

  let text: string;
  try {
    text = await callGemini(history);
  } catch (error) {
    const isContextError =
      error instanceof Error &&
      (error.message.includes("token") ||
        error.message.includes("context") ||
        error.message.includes("limit") ||
        error.message.includes("too long") ||
        error.message.includes("400") ||
        error.message.includes("429"));

    if (isContextError && history.length > RETRY_HISTORY_MESSAGES) {
      logger.warn({ businessId: business.id, historyLen: history.length }, "Context too long — retrying with shorter history");
      try {
        text = await callGemini(history.slice(-RETRY_HISTORY_MESSAGES));
      } catch (retryError) {
        logger.error({ retryError, businessId: business.id }, "Gemini retry also failed");
        throw retryError;
      }
    } else {
      logger.error({ error, businessId: business.id }, "Gemini API error");
      throw error;
    }
  }

  const msgLower = customerMessage.toLowerCase();
  const purchaseIntent =
    !!business.upiId &&
    PURCHASE_INTENT_KEYWORDS.some((kw) => msgLower.includes(kw));

  return {
    text,
    purchaseIntent,
    detectedProductName: topProduct?.name,
    detectedProductPrice: topProduct?.price,
  };
}

interface TopProduct {
  name: string;
  price: number;
}

async function retrieveRelevantChunks(
  businessId: number,
  query: string,
  topK = 4
): Promise<{ ragContext: string | null; topProduct: TopProduct | null }> {
  // Always load all knowledge chunks for this business
  const allChunks = await db
    .select({
      id: knowledgeChunksTable.id,
      title: knowledgeChunksTable.title,
      content: knowledgeChunksTable.content,
      sourceType: knowledgeChunksTable.sourceType,
      embedding: knowledgeChunksTable.embedding,
    })
    .from(knowledgeChunksTable)
    .where(eq(knowledgeChunksTable.businessId, businessId));

  if (allChunks.length === 0) return { ragContext: null, topProduct: null };

  let relevant: typeof allChunks;

  // Try vector search if any chunks have embeddings
  const hasEmbeddings = allChunks.some((c) => c.embedding !== null);
  if (hasEmbeddings) {
    try {
      const queryEmbedding = await embedText(query);
      const embeddingLiteral = `[${queryEmbedding.join(",")}]`;

      const results = await db.execute(sql`
        SELECT id, title, content, source_type,
               1 - (embedding <=> ${embeddingLiteral}::vector) AS similarity
        FROM business_knowledge_chunks
        WHERE business_id = ${businessId}
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${embeddingLiteral}::vector
        LIMIT ${topK}
      `);

      const rows = results.rows as Array<{
        id: number; title: string; content: string;
        source_type: string; similarity: number;
      }>;

      const vectorMatches = rows.filter((r) => r.similarity > 0.35);
      if (vectorMatches.length > 0) {
        relevant = vectorMatches.map((r) => ({
          id: r.id, title: r.title, content: r.content,
          sourceType: r.source_type, embedding: null,
        }));
      } else {
        // Vector search returned nothing useful — fall back to all chunks
        relevant = allChunks;
      }
    } catch {
      // Embedding call failed — fall back to all chunks
      relevant = allChunks;
    }
  } else {
    // No embeddings at all — inject every chunk so the AI has full product data
    relevant = allChunks;
  }

  const contextBlock = relevant
    .map((r) => `[${r.sourceType.toUpperCase()}] ${r.title}:\n${r.content}`)
    .join("\n\n---\n\n");

  // Extract product name/price from the first product chunk
  let topProduct: TopProduct | null = null;
  const productChunk = relevant.find((r) =>
    r.sourceType === "firebase_product" || r.sourceType === "product"
  );
  if (productChunk) {
    const priceMatch = productChunk.content.match(/Price:\s*₹(\d+(?:\.\d+)?)/);
    if (priceMatch) {
      topProduct = {
        name: productChunk.title,
        price: parseFloat(priceMatch[1]!),
      };
    }
  }

  logger.info({ businessId, chunks: relevant.length, vectorSearch: hasEmbeddings }, "RAG context loaded");

  return {
    ragContext: `PRODUCT KNOWLEDGE BASE (use ONLY this data for product info and links — do not invent any URLs):\n\n${contextBlock}`,
    topProduct,
  };
}

function buildSystemPrompt(business: Business): string {
  let prompt = `You are an AI sales assistant for ${business.name}, a ${business.businessType}.

${business.description}

${business.systemPrompt}

IMPORTANT GUIDELINES:
- Be friendly, helpful, and professional
- Stay focused on helping customers with their needs related to this business
- If asked about something outside your knowledge, say so politely
- Keep responses concise and conversational (suitable for WhatsApp)
- Do not use markdown formatting — plain text only
- Always try to move customers towards making a purchase or booking
- When sharing product links, ONLY use links from the PRODUCT KNOWLEDGE BASE section — never invent or guess URLs
- If you do not have a product link in the knowledge base, do NOT share any URL at all${
  business.storeSlug
    ? `\n- When a customer asks to see all products or browse the full range, share the store page: https://store.advize.in/store/${business.storeSlug}`
    : ""
}`;

  if (business.products) {
    prompt += `\n\nOUR PRODUCTS/SERVICES:\n${business.products}`;
  }

  if (business.faqs) {
    prompt += `\n\nFREQUENTLY ASKED QUESTIONS:\n${business.faqs}`;
  }

  return prompt;
}
