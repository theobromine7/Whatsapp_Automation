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
  intent: string;
  confidence: number;
  purchaseIntent: boolean;
  detectedProductName?: string;
  detectedProductPrice?: number;
}

// ── Business Hours ────────────────────────────────────────────────────────────

interface BusinessHours {
  enabled: boolean;
  timezone: string;   // e.g. "Asia/Kolkata"
  openTime: string;   // "09:00" (24h)
  closeTime: string;  // "21:00" (24h)
  days: number[];     // 0=Sun, 1=Mon … 6=Sat
}

export function isWithinBusinessHours(businessHoursJson: string | null | undefined): boolean {
  if (!businessHoursJson) return true; // Not configured → always open

  let hours: BusinessHours;
  try {
    hours = JSON.parse(businessHoursJson) as BusinessHours;
  } catch {
    return true;
  }

  if (!hours.enabled) return true;

  try {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: hours.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "short",
    });

    const parts = fmt.formatToParts(now);
    const dayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };

    const dayName = parts.find((p) => p.type === "weekday")?.value ?? "";
    const currentDay = dayMap[dayName] ?? 0;
    const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
    const minStr = parts.find((p) => p.type === "minute")?.value ?? "0";
    const currentMinutes = parseInt(hourStr) * 60 + parseInt(minStr);

    const [openH = 0, openM = 0] = hours.openTime.split(":").map(Number);
    const [closeH = 23, closeM = 59] = hours.closeTime.split(":").map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    if (!hours.days.includes(currentDay)) return false;
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  } catch {
    return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const MAX_HISTORY_MESSAGES = 20;
const RETRY_HISTORY_MESSAGES = 6;

export async function generateAIResponse(
  business: Business,
  conversationId: number,
  customerMessage: string
): Promise<AIResponseResult> {
  const withinHours = isWithinBusinessHours(business.businessHours);
  const systemPrompt = buildSystemPrompt(business, withinHours);

  const recentRows = await db
    .select()
    .from(whatsappMessagesTable)
    .where(eq(whatsappMessagesTable.conversationId, conversationId))
    .orderBy(desc(whatsappMessagesTable.createdAt))
    .limit(MAX_HISTORY_MESSAGES);

  const history = recentRows.reverse();

  const { ragContext, topProduct } = await retrieveRelevantChunks(business.id, customerMessage);

  const fullSystemPrompt = ragContext
    ? `${systemPrompt}\n\n${ragContext}`
    : systemPrompt;

  const paymentPrompt = business.upiId
    ? `\n\nPAYMENT: If a customer wants to buy something, tell them you will send a payment QR code. UPI ID: ${business.upiId}`
    : "";

  // JSON response format instruction — must be last in the system instruction
  const jsonFormatInstruction = `

RESPONSE FORMAT — You MUST respond ONLY with valid JSON matching this schema exactly:
{
  "intent": "<one-sentence description of what the customer is asking>",
  "confidence": <number 0.0–1.0>,
  "reply": "<your actual response, plain text only, no markdown>"
}

Confidence scoring guide:
- 0.90–1.00: Clear product/price/availability/order question; you have specific knowledge to answer accurately
- 0.70–0.89: Sales inquiry with some ambiguity; you can answer but may be incomplete
- 0.50–0.69: Unclear intent or only partial knowledge available
- 0.00–0.49: Cannot determine sales context, or the question requires data you don't have`;

  const systemInstruction = fullSystemPrompt + paymentPrompt + jsonFormatInstruction;

  const buildContents = (msgs: typeof history) => {
    const contents = msgs.map((msg) => ({
      role: msg.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: msg.content }],
    }));
    contents.push({ role: "user", parts: [{ text: customerMessage }] });
    return contents;
  };

  const callGemini = async (msgs: typeof history): Promise<AIResponseResult> => {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: buildContents(msgs),
      config: {
        systemInstruction,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    });

    const raw = (response.text ?? "").trim();
    return parseStructuredResponse(raw, customerMessage, business.upiId, topProduct);
  };

  try {
    const result = await callGemini(history);
    return result;
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
        return await callGemini(history.slice(-RETRY_HISTORY_MESSAGES));
      } catch (retryError) {
        logger.error({ retryError, businessId: business.id }, "Gemini retry also failed");
        throw retryError;
      }
    }

    logger.error({ error, businessId: business.id }, "Gemini API error");
    throw error;
  }
}

function parseStructuredResponse(
  raw: string,
  customerMessage: string,
  upiId: string | null | undefined,
  topProduct: { name: string; price: number } | null
): AIResponseResult {
  let intent = "general inquiry";
  let confidence = 1.0;
  let text = raw;

  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned) as {
      intent?: string;
      confidence?: number;
      reply?: string;
    };

    intent = typeof parsed.intent === "string" ? parsed.intent : intent;
    confidence = typeof parsed.confidence === "number"
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 1.0;
    text = typeof parsed.reply === "string" && parsed.reply.trim()
      ? parsed.reply.trim()
      : raw;
  } catch {
    // Non-JSON response — use raw text with high confidence (don't block it)
    confidence = 0.9;
  }

  const msgLower = customerMessage.toLowerCase();
  const purchaseIntent =
    !!upiId &&
    PURCHASE_INTENT_KEYWORDS.some((kw) => msgLower.includes(kw));

  return {
    text,
    intent,
    confidence,
    purchaseIntent,
    detectedProductName: topProduct?.name,
    detectedProductPrice: topProduct?.price,
  };
}

// ── RAG ───────────────────────────────────────────────────────────────────────

interface TopProduct {
  name: string;
  price: number;
}

async function retrieveRelevantChunks(
  businessId: number,
  query: string,
  topK = 4
): Promise<{ ragContext: string | null; topProduct: TopProduct | null }> {
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
      relevant = vectorMatches.length > 0
        ? vectorMatches.map((r) => ({ id: r.id, title: r.title, content: r.content, sourceType: r.source_type, embedding: null }))
        : allChunks;
    } catch {
      relevant = allChunks;
    }
  } else {
    relevant = allChunks;
  }

  const contextBlock = relevant
    .map((r) => `[${r.sourceType.toUpperCase()}] ${r.title}:\n${r.content}`)
    .join("\n\n---\n\n");

  let topProduct: TopProduct | null = null;
  const productChunk = relevant.find((r) =>
    r.sourceType === "firebase_product" || r.sourceType === "product"
  );
  if (productChunk) {
    const priceMatch = productChunk.content.match(/Price:\s*₹(\d+(?:\.\d+)?)/);
    if (priceMatch) {
      topProduct = { name: productChunk.title, price: parseFloat(priceMatch[1]!) };
    }
  }

  logger.info({ businessId, chunks: relevant.length, vectorSearch: hasEmbeddings }, "RAG context loaded");

  return {
    ragContext: `PRODUCT KNOWLEDGE BASE (use ONLY this data for product info, prices, and stock — NEVER invent or guess any price, availability, or URL not listed here):\n\n${contextBlock}`,
    topProduct,
  };
}

// ── System Prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(business: Business, withinBusinessHours: boolean): string {
  const hoursNote = !withinBusinessHours
    ? `\n\nBUSINESS HOURS: The business is currently OUTSIDE operating hours. Politely acknowledge this, capture the customer's inquiry details, and assure them that the team will follow up during business hours. Still answer product questions you have data for.`
    : "";

  let prompt = `You are an AI sales assistant for ${business.name}, a ${business.businessType}.

${business.description}

${business.systemPrompt}

CORE RULES — follow these strictly:
- You are a SALES ASSISTANT, not a general chatbot. Stay focused on sales, products, pricing, availability, orders, and delivery.
- Be friendly, concise, and conversational (WhatsApp style — short paragraphs, no bullet formatting, plain text only).
- NEVER invent, guess, or estimate any price, stock level, or product URL. If you don't have data for it, say so clearly.
- ONLY share product links or URLs that appear verbatim in the PRODUCT KNOWLEDGE BASE. Do not guess or construct URLs.
- If asked about something completely outside your sales scope, politely redirect to what you can help with.
- Always move the conversation toward a purchase decision or lead capture.${hoursNote}${
  business.storeSlug
    ? `\n- When a customer asks to browse all products, share: https://store.advize.in/store/${business.storeSlug}`
    : ""
}`;

  if (business.products) {
    prompt += `\n\nOUR PRODUCTS / SERVICES:\n${business.products}`;
  }

  if (business.faqs) {
    prompt += `\n\nFREQUENTLY ASKED QUESTIONS:\n${business.faqs}`;
  }

  return prompt;
}
