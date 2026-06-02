import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";

export const CONTACT_TYPES = [
  "SALES_LEAD",
  "CUSTOMER",
  "PERSONAL_CONTACT",
  "FAMILY",
  "STAFF",
  "SUPPLIER",
  "UNKNOWN",
] as const;

export const CONTACT_TAGS = [
  "PERSONAL",
  "FAMILY",
  "STAFF",
  "SUPPLIER",
  "CUSTOMER",
  "LEAD",
] as const;

export type ContactType = (typeof CONTACT_TYPES)[number];
export type ContactTag = (typeof CONTACT_TAGS)[number];

export const whatsappConversationsTable = pgTable("whatsapp_conversations", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  customerPhone: text("customer_phone").notNull(),
  customerJid: text("customer_jid"),
  customerName: text("customer_name"),

  // Human takeover state: 'AI_ACTIVE' (default) | 'OWNER_TAKEN_OVER'
  aiState: text("ai_state").notNull().default("AI_ACTIVE"),
  // When the owner last sent a message in this conversation (used for 30-min auto-resume)
  ownerLastMessageAt: timestamp("owner_last_message_at", { withTimezone: true }),

  // Conversation Control Layer
  // AI-classified contact type (set on first message using Gemini)
  contactType: text("contact_type").$type<ContactType>(),
  // Manually set by owner to permanently tag a contact
  contactTag: text("contact_tag").$type<ContactTag>(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWhatsappConversationSchema = createInsertSchema(whatsappConversationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWhatsappConversation = z.infer<typeof insertWhatsappConversationSchema>;
export type WhatsappConversation = typeof whatsappConversationsTable.$inferSelect;
