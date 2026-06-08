import OpenAI from "openai";
import { db, whatsappMessagesTable, knowledgeChunksTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { logger } from "./logger";
import type { Business } from "@workspace/db";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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
  needsOwner: boolean;
  skip: boolean;
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
  if (!businessHoursJson) return true;

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

  const [recentRows, { ragContext, topProduct }] = await Promise.all([
    db
      .select()
      .from(whatsappMessagesTable)
      .where(eq(whatsappMessagesTable.conversationId, conversationId))
      .orderBy(desc(whatsappMessagesTable.createdAt))
      .limit(MAX_HISTORY_MESSAGES),
    retrieveRelevantChunks(business.id, customerMessage),
  ]);

  const history = recentRows.reverse();

  const fullSystemPrompt = ragContext
    ? `${systemPrompt}\n\n${ragContext}`
    : systemPrompt;

  const paymentPrompt = business.upiId
    ? `\n\nPAYMENT: If a customer wants to buy something, tell them you will send a payment QR code. UPI ID: ${business.upiId}`
    : "";

  const jsonFormatInstruction = `

RESPONSE FORMAT — You MUST respond ONLY with valid JSON matching this schema exactly:
{
  "intent": "<one-sentence description of what the customer is asking>",
  "confidence": <number 0.0–1.0>,
  "needsOwner": <true or false>,
  "skip": <true or false>,
  "reply": "<your actual response — plain text only, no markdown, MAXIMUM 20 WORDS>"
}

skip rules — set skip to true (and leave reply blank) when NO reply is needed:
- Message is a pure acknowledgement with no question: "ok", "thanks", "noted", "got it", "👍", "seen", "alright"
- Customer just confirmed they received info and asked nothing new
- The conversation has naturally ended and nothing was asked
- You already answered this exact question in the immediately preceding message
Set skip to false for ALL other cases — including greetings, product questions, complaints, and anything requiring an answer.

Confidence scoring guide:
- 0.90–1.00: Clear product/price/availability/order question; you have specific knowledge to answer accurately
- 0.70–0.89: Sales inquiry with some ambiguity; you can answer but may be incomplete
- 0.50–0.69: Unclear intent or only partial knowledge available
- 0.00–0.49: Cannot determine sales context, or the question requires data you don't have

needsOwner rules — set to true when ANY of the following apply:
- Customer explicitly asks to speak to a human, owner, manager, or real person (e.g. "connect me to owner", "talk to someone", "speak to a human", "real person please", "baat karni hai owner se")
- Customer requests a callback, phone call, or video call
- Customer has a complaint or issue that requires personal attention
- Customer asks for a custom deal, negotiation, or bulk order that you cannot confirm
- Customer expresses frustration or dissatisfaction and needs personal follow-up
- The request is completely outside your product/service scope and you have no useful answer
Set needsOwner to false for all normal product, price, availability, or FAQ questions you can answer.`;

  const systemInstruction = fullSystemPrompt + paymentPrompt + jsonFormatInstruction;

  const buildMessages = (msgs: typeof history): OpenAI.Chat.ChatCompletionMessageParam[] => {
    const result: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemInstruction },
      ...msgs.map((msg) => ({
        role: (msg.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
        content: msg.content,
      })),
      { role: "user", content: customerMessage },
    ];
    return result;
  };

  const callOpenAI = async (msgs: typeof history): Promise<AIResponseResult> => {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: buildMessages(msgs),
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const raw = (response.choices[0]?.message?.content ?? "").trim();
    return parseStructuredResponse(raw, customerMessage, business.upiId, topProduct);
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  try {
    return await callOpenAI(history);
  } catch (error) {
    const is429 =
      error instanceof Error &&
      (error.message.includes("429") || error.message.includes("rate_limit") || error.message.includes("Rate limit"));
    if (is429) {
      logger.warn({ businessId: business.id }, "OpenAI 429 rate limit — retrying in 2s");
      await sleep(2000);
      try {
        return await callOpenAI(history);
      } catch (retryError) {
        logger.error({ retryError, businessId: business.id }, "OpenAI 429 retry also failed");
        throw retryError;
      }
    }

    const isContextError =
      error instanceof Error &&
      (error.message.includes("token") ||
        error.message.includes("context") ||
        error.message.includes("limit") ||
        error.message.includes("too long") ||
        error.message.includes("400"));

    if (isContextError && history.length > RETRY_HISTORY_MESSAGES) {
      logger.warn({ businessId: business.id, historyLen: history.length }, "Context too long — retrying with shorter history");
      try {
        return await callOpenAI(history.slice(-RETRY_HISTORY_MESSAGES));
      } catch (retryError) {
        logger.error({ retryError, businessId: business.id }, "OpenAI retry also failed");
        throw retryError;
      }
    }

    logger.error({ error, businessId: business.id }, "OpenAI API error");
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
  let needsOwner = false;
  let skip = false;
  let text = raw;

  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned) as {
      intent?: string;
      confidence?: number;
      needsOwner?: boolean;
      skip?: boolean;
      reply?: string;
    };

    intent = typeof parsed.intent === "string" ? parsed.intent : intent;
    confidence = typeof parsed.confidence === "number"
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 1.0;
    needsOwner = parsed.needsOwner === true;
    skip = parsed.skip === true;

    if (skip) {
      text = "";
    } else if (typeof parsed.reply === "string" && parsed.reply.trim()) {
      text = parsed.reply.trim();
    } else {
      logger.warn({ raw }, "OpenAI JSON missing reply field — using fallback");
      text = "How can I help you?";
    }
  } catch {
    const looksLikeJson = raw.trim().startsWith("{") || raw.trim().startsWith("[");
    if (!looksLikeJson && raw.trim().length > 0) {
      text = raw.trim();
      confidence = 0.9;
    } else {
      logger.warn({ raw }, "OpenAI returned unparseable response — using fallback");
      text = "How can I help you?";
      confidence = 0.5;
    }
  }

  const msgLower = customerMessage.toLowerCase();
  const purchaseIntent =
    !!upiId &&
    !skip &&
    PURCHASE_INTENT_KEYWORDS.some((kw) => msgLower.includes(kw));

  return {
    text,
    intent,
    confidence,
    purchaseIntent,
    needsOwner,
    skip,
    detectedProductName: topProduct?.name,
    detectedProductPrice: topProduct?.price,
  };
}

// ── RAG ───────────────────────────────────────────────────────────────────────

interface TopProduct {
  name: string;
  price: number;
}

async function embedText(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0]!.embedding;
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

  const hasProductContext = !!(business.products || business.faqs);

  const noContextWarning = !hasProductContext
    ? `\n\nIMPORTANT — NO CATALOG DATA: You have no product catalog, pricing, or store information available yet. Do NOT invent, assume, or guess any product names, prices, availability, or URLs. If asked about products or prices, say something like "Let me get those details for you — what are you looking for?" and keep it short.`
    : "";

  let prompt = `You are a sales agent for ${business.name}, a ${business.businessType ?? "business"}.

${business.description ?? ""}

${business.systemPrompt ?? ""}

CORE RULES — follow these strictly in order of priority:

PRIORITY 1 — FAQs (highest priority):
- If the customer's question matches or relates to any FAQ in the FREQUENTLY ASKED QUESTIONS section, answer ONLY from that FAQ. Use it verbatim or paraphrase it naturally. Do NOT add extra information or contradict the FAQ answer.
- FAQs override everything else — product descriptions, general knowledge, and your own reasoning.

PRIORITY 2 — Product Knowledge Base:
- For product questions not covered by FAQs, use ONLY the PRODUCT KNOWLEDGE BASE. Never invent prices, stock, or details.

PRIORITY 3 — General Sales Rules:
- You are a human sales agent, NOT an AI or chatbot. Never say "I'm an AI", "as an AI", or anything that reveals you are automated. If directly asked if you are a bot or AI, deflect naturally — e.g. "I'm here to help you, what are you looking for?" — and move on.
- You are a SALES AGENT. Stay focused on products, pricing, availability, orders, and delivery. Do not engage in general or off-topic chat.
- REPLY LENGTH: Keep every reply under 20 words. Be direct, short, and conversational (WhatsApp style). No bullet points, no markdown, plain text only.
- NEVER invent, guess, or estimate any price, stock level, or URL. Only state what you know for certain from your product data.
- If a product, category, or item is not available or not in your catalog, tell the customer directly and clearly — e.g. "Sorry, we don't carry that." Then offer the closest alternative if one exists.
- ONLY share product links or URLs that appear verbatim in the PRODUCT KNOWLEDGE BASE. Do not construct or guess URLs.
- When a customer asks for multiple product links, or wants to browse all/many products, do NOT list individual links. Instead, send them the store link to browse everything.
- Always push the conversation toward a purchase or capture what the customer needs.
- DO NOT reply when no reply is needed — set skip: true for pure acknowledgements like "ok", "thanks", "noted", "👍", "seen".${noContextWarning}${hoursNote}${
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
