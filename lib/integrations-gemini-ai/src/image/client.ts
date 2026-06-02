import { GoogleGenAI, Modality } from "@google/genai";

function getImageAi(): GoogleGenAI {
  const apiKey =
    process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "A Gemini API key must be set. Please set GEMINI_API_KEY in your secrets.",
    );
  }

  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const isReplitProxy = baseUrl && !baseUrl.includes("googleapis.com");

  return new GoogleGenAI(
    isReplitProxy
      ? { apiKey, httpOptions: { apiVersion: "", baseUrl } }
      : { apiKey },
  );
}

export const ai = new Proxy({} as GoogleGenAI, {
  get(_target, prop) {
    return (getImageAi() as any)[prop];
  },
});

export async function generateImage(
  prompt: string
): Promise<{ b64_json: string; mimeType: string }> {
  const client = getImageAi();
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find(
    (part: { inlineData?: { data?: string; mimeType?: string } }) => part.inlineData
  );

  if (!imagePart?.inlineData?.data) {
    throw new Error("No image data in response");
  }

  return {
    b64_json: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || "image/png",
  };
}
