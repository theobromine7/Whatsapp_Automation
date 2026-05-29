import { GoogleGenAI } from "@google/genai";

const apiKey =
  process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    "A Gemini API key must be set. Please set GEMINI_API_KEY in your secrets.",
  );
}

const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
const isReplitProxy = baseUrl && !baseUrl.includes("googleapis.com");

export const ai = new GoogleGenAI(
  isReplitProxy
    ? {
        apiKey,
        httpOptions: { apiVersion: "", baseUrl },
      }
    : {
        apiKey,
      }
);
