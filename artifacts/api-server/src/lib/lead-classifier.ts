import { ai } from "@workspace/integrations-gemini-ai";
import { logger } from "./logger";
import type { ContactType } from "@workspace/db";

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
 * Classify an incoming message to determine if the AI should auto-reply.
 *
 * Returns one of: SALES_LEAD, CUSTOMER, PERSONAL_CONTACT, FAMILY, STAFF, SUPPLIER, UNKNOWN
 *
 * Only SALES_LEAD and CUSTOMER should receive AI auto-replies.
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
 * Determine whether the AI should auto-reply based on contactType and contactTag.
 * contactTag (owner-set) takes precedence over contactType (AI-classified).
 */
export function shouldAutoReply(
  contactType: ContactType | null | undefined,
  contactTag: string | null | undefined
): boolean {
  // Owner-set tag takes highest precedence
  if (contactTag) {
    const blocked = ["PERSONAL", "FAMILY", "STAFF", "SUPPLIER"];
    if (blocked.includes(contactTag)) return false;
    // CUSTOMER and LEAD tags explicitly allow replies
    if (contactTag === "CUSTOMER" || contactTag === "LEAD") return true;
  }

  // AI-classified type
  if (contactType) {
    const allowed: ContactType[] = ["SALES_LEAD", "CUSTOMER"];
    return allowed.includes(contactType);
  }

  // If neither is set yet (first classification hasn't run), allow by default
  return true;
}
