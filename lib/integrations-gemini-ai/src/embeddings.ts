import { GoogleGenAI } from "@google/genai";

const apiKey =
  process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    "A Gemini API key must be set. Please set GEMINI_API_KEY in your secrets.",
  );
}

const embeddingClient = new GoogleGenAI({ apiKey });

const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_DIMENSIONS = 768;

export { EMBEDDING_DIMENSIONS };

export async function embedText(text: string): Promise<number[]> {
  const result = await embeddingClient.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
  });

  const values = result.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error("Gemini returned empty embedding");
  }
  return values;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(embedText));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
