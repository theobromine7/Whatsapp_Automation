import { GoogleGenAI } from "@google/genai";

let _ai: GoogleGenAI | null = null;

export function getAi(): GoogleGenAI {
  if (_ai) return _ai;

  const apiKey =
    process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "A Gemini API key must be set. Please set GEMINI_API_KEY in your secrets.",
    );
  }

  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const isReplitProxy = baseUrl && !baseUrl.includes("googleapis.com");

  _ai = new GoogleGenAI(
    isReplitProxy
      ? {
          apiKey,
          httpOptions: { apiVersion: "", baseUrl },
        }
      : {
          apiKey,
        }
  );

  return _ai;
}

export const ai = new Proxy({} as GoogleGenAI, {
  get(_target, prop) {
    return (getAi() as any)[prop];
  },
});
