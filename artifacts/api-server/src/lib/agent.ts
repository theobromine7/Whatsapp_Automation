import { ai, embedText } from "@workspace/integrations-gemini-ai";
import { db, whatsappMessagesTable, knowledgeChunksTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
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

export async function generateAIResponse(
  business: Business,
  conversationId: number,
  customerMessage: string
): Promise<AIResponseResult> {
  const systemPrompt = buildSystemPrompt(business);

  const history = await db
    .select()
    .from(whatsappMessagesTable)
    .where(eq(whatsappMessagesTable.conversationId, conversationId))
    .orderBy(whatsappMessagesTable.createdAt);

  const chatHistory = history.map((msg) => ({
    role: msg.role === "assistant" ? "model" as const : "user" as const,
    parts: [{ text: msg.content }],
  }));

  chatHistory.push({
    role: "user",
    parts: [{ text: customerMessage }],
  });

  const { ragContext, topProduct } = await retrieveRelevantChunks(business.id, customerMessage);

  const fullSystemPrompt = ragContext
    ? `${systemPrompt}\n\n${ragContext}`
    : systemPrompt;

  // Add UPI payment instructions to system prompt if store has UPI configured
  const paymentPrompt = business.upiId
    ? `\n\nPAYMENT: If a customer wants to buy something, tell them you will send them a payment QR code. UPI ID: ${business.upiId}`
    : "";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: chatHistory,
      config: {
        systemInstruction: fullSystemPrompt + paymentPrompt,
        maxOutputTokens: 8192,
      },
    });

    const text = response.text ?? "I'm sorry, I couldn't generate a response. Please try again.";

    // Detect purchase intent
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
  } catch (error) {
    logger.error({ error, businessId: business.id }, "Gemini API error");
    throw error;
  }
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
  try {
    const chunks = await db
      .select({ id: knowledgeChunksTable.id })
      .from(knowledgeChunksTable)
      .where(eq(knowledgeChunksTable.businessId, businessId))
      .limit(1);

    if (chunks.length === 0) return { ragContext: null, topProduct: null };

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
      id: number;
      title: string;
      content: string;
      source_type: string;
      similarity: number;
    }>;

    if (rows.length === 0) return { ragContext: null, topProduct: null };

    const relevant = rows.filter((r) => r.similarity > 0.35);
    if (relevant.length === 0) return { ragContext: null, topProduct: null };

    const contextBlock = relevant
      .map((r) => `[${r.source_type.toUpperCase()}] ${r.title}:\n${r.content}`)
      .join("\n\n---\n\n");

    // Extract product name/price from the top firebase_product chunk
    let topProduct: TopProduct | null = null;
    const productChunk = relevant.find((r) =>
      r.source_type === "firebase_product" || r.source_type === "product"
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

    return {
      ragContext: `RELEVANT KNOWLEDGE BASE (use this to answer accurately):\n\n${contextBlock}`,
      topProduct,
    };
  } catch (err) {
    logger.warn({ err, businessId }, "RAG retrieval failed, proceeding without context");
    return { ragContext: null, topProduct: null };
  }
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
- When sharing product links, ONLY use links from the RELEVANT KNOWLEDGE BASE section below — never invent or guess URLs
- If you do not have a product link in the knowledge base, do NOT share any URL at all`;

  if (business.products) {
    prompt += `\n\nOUR PRODUCTS/SERVICES:\n${business.products}`;
  }

  if (business.faqs) {
    prompt += `\n\nFREQUENTLY ASKED QUESTIONS:\n${business.faqs}`;
  }

  return prompt;
}
