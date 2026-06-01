import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";

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
