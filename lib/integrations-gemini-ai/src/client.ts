import { GoogleGenAI } from "@google/genai";

if (!process.env.AI_INTEGRATIONS_GEMINI_BASE_URL) {
  throw new Error(
    "AI_INTEGRATIONS_GEMINI_BASE_URL must be set. Did you forget to provision the Gemini AI integration?",
  );
}

if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
  throw new Error(
    "AI_INTEGRATIONS_GEMINI_API_KEY must be set. Did you forget to provision the Gemini AI integration?",
  );
}

const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!;
const isReplitProxy = !baseUrl.includes("googleapis.com");

export const ai = new GoogleGenAI(
  isReplitProxy
    ? {
        apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
        httpOptions: { apiVersion: "", baseUrl },
      }
    : {
        apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
      }
);
