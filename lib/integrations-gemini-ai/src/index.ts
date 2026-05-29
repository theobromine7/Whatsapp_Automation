export { ai } from "./client";
export { generateImage } from "./image";
export { batchProcess, batchProcessWithSSE, isRateLimitError, type BatchOptions } from "./batch";
export { embedText, embedTexts, cosineSimilarity, EMBEDDING_DIMENSIONS } from "./embeddings";
