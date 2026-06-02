import { ai } from "@workspace/integrations-gemini-ai";
import { logger } from "./logger";
import type { ContactType, AiState } from "@workspace/db";

const VALID_TYPES: ContactType[] = [
  "SALES_LEAD",
  "CUSTOMER",
  "PERSONAL_CONTACT",
  "FAMILY",
  "STAFF",
  "SUPPLIER",
  "UNKNOWN",
];

/**
 * Classify an incoming message to determine contact type.
 *
 * Returns one of: SALES_LEAD, CUSTOMER, PERSONAL_CONTACT, FAMILY, STAFF, SUPPLIER, UNKNOWN
 */
export async function classifyContact(messageText: string, customerName: string | null): Promise<ContactType> {
  const nameHint = customerName ? ` The sender's name is "${customerName}".` : "";

  const prompt = `You are a WhatsApp message classifier for a business AI sales agent.
Classify the incoming WhatsApp message into exactly one of these categories:

- SALES_LEAD: Person asking about products, prices, availability, shipping, or making a purchase inquiry. They are a potential new customer.
- CUSTOMER: Existing customer asking about their order, delivery, support, or sending feedback after a purchase.
- PERSONAL_CONTACT: Personal/social message — friends, colleagues, or acquaintances. Casual greetings, personal topics, "bro", "dude", "yaar", asking about whereabouts, etc.
- FAMILY: Family member messages — references to home, family events, parents, siblings, domestic topics.
- STAFF: Employee or team member — work updates, shift schedules, internal operations, "sir the delivery is done", etc.
- SUPPLIER: Vendor or supplier — raw material delivery, invoices, restock, wholesale pricing from a vendor.
- UNKNOWN: Cannot determine from the message alone.

Rules:
- Return ONLY the category name, nothing else. No explanation, no punctuation.
- If the message is clearly about buying something, always return SALES_LEAD.
- Casual personal messages should be PERSONAL_CONTACT, not SALES_LEAD.${nameHint}

Message: "${messageText.slice(0, 300)}"

Category:`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 20, temperature: 0 },
    });

    const raw = (response.text ?? "").trim().toUpperCase() as ContactType;
    if (VALID_TYPES.includes(raw)) return raw;

    logger.warn({ raw, message: messageText }, "Lead classifier returned unexpected value, defaulting to UNKNOWN");
    return "UNKNOWN";
  } catch (err) {
    logger.error({ err }, "Lead classification failed — defaulting to UNKNOWN");
    return "UNKNOWN";
  }
}

/**
 * Derive the initial aiState from a freshly classified contactType.
 *
 * Personal / non-business contacts → PERSONAL_CONTACT (AI never replies)
 * Sales leads / customers          → NEW_LEAD (AI will engage)
 * Unknown                          → NEW_LEAD (benefit of the doubt)
 */
export function initialAiStateFromContactType(contactType: ContactType): AiState {
  const nonBusiness: ContactType[] = ["PERSONAL_CONTACT", "FAMILY", "STAFF", "SUPPLIER"];
  return nonBusiness.includes(contactType) ? "PERSONAL_CONTACT" : "NEW_LEAD";
}

/**
 * Determine whether the AI should auto-reply based on the conversation aiState.
 * BLOCKED and PERSONAL_CONTACT are permanent silences.
 * OWNER_TAKEN_OVER is a temporary silence.
 * NEW_LEAD and AI_ACTIVE allow replies (subject to intent filter).
 */
export function shouldAutoReply(aiState: string): boolean {
  return aiState === "NEW_LEAD" || aiState === "AI_ACTIVE";
}

/**
 * Low-value message filter (Feature 6).
 *
 * Returns true when the message is a short social acknowledgement with no
 * business intent — these should NOT trigger an AI reply.
 *
 * Examples: "ok", "thanks", "👍", "done", "noted", "sure", "k"
 */
export function isLowValueMessage(text: string): boolean {
  const normalised = text.trim().toLowerCase();

  // Single emoji reactions or punctuation only
  if (/^[\p{Emoji}\s!.?,]*$/u.test(normalised) && normalised.length <= 8) return true;

  // Common low-value phrases (full match, allowing trailing punctuation)
  const LOW_VALUE_PHRASES = [
    "ok", "okay", "k", "kk",
    "thanks", "thank you", "thx", "thnx", "ty",
    "done", "noted", "noted thanks", "noted thank you",
    "alright", "alright thanks",
    "got it", "got it thanks",
    "sure", "sure thanks",
    "hmm", "hm", "uh",
    "great", "nice", "cool", "good", "wow",
    "bye", "goodbye", "cya",
    "hello", "hi", "hey", "hii", "hiii",
    "yes", "no", "yep", "nope", "nah", "yeah",
  ];

  const stripped = normalised.replace(/[!.,?]+$/, "").trim();
  return LOW_VALUE_PHRASES.includes(stripped);
}
