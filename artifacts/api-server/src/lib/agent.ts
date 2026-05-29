import { ai, embedText } from "@workspace/integrations-gemini-ai";
import { db, whatsappMessagesTable, knowledgeChunksTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";
import type { Business } from "@workspace/db";

export async function generateAIResponse(
  business: Business,
  conversationId: number,
  customerMessage: string
): Promise<string> {
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

  const ragContext = await retrieveRelevantChunks(business.id, customerMessage);

  const fullSystemPrompt = ragContext
    ? `${systemPrompt}\n\n${ragContext}`
    : systemPrompt;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: chatHistory,
      config: {
        systemInstruction: fullSystemPrompt,
        maxOutputTokens: 8192,
      },
    });

    return response.text ?? "I'm sorry, I couldn't generate a response. Please try again.";
  } catch (error) {
    logger.error({ error, businessId: business.id }, "Gemini API error");
    throw error;
  }
}

async function retrieveRelevantChunks(
  businessId: number,
  query: string,
  topK = 3
): Promise<string | null> {
  try {
    const chunks = await db
      .select({ id: knowledgeChunksTable.id })
      .from(knowledgeChunksTable)
      .where(eq(knowledgeChunksTable.businessId, businessId))
      .limit(1);

    if (chunks.length === 0) return null;

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

    if (rows.length === 0) return null;

    const relevant = rows.filter((r) => r.similarity > 0.4);
    if (relevant.length === 0) return null;

    const contextBlock = relevant
      .map((r) => `[${r.source_type.toUpperCase()}] ${r.title}:\n${r.content}`)
      .join("\n\n---\n\n");

    return `RELEVANT KNOWLEDGE BASE (use this to answer accurately):\n\n${contextBlock}`;
  } catch (err) {
    logger.warn({ err, businessId }, "RAG retrieval failed, proceeding without context");
    return null;
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
- Always try to move customers towards making a purchase or booking`;

  if (business.products) {
    prompt += `\n\nOUR PRODUCTS/SERVICES:\n${business.products}`;
  }

  if (business.faqs) {
    prompt += `\n\nFREQUENTLY ASKED QUESTIONS:\n${business.faqs}`;
  }

  return prompt;
}
