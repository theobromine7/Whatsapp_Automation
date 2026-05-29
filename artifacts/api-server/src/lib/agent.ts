import { ai } from "@workspace/integrations-gemini-ai";
import { db, whatsappMessagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: chatHistory,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 8192,
      },
    });

    return response.text ?? "I'm sorry, I couldn't generate a response. Please try again.";
  } catch (error) {
    logger.error({ error, businessId: business.id }, "Gemini API error");
    throw error;
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
