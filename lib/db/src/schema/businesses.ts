import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const businessesTable = pgTable("businesses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  businessType: text("business_type").notNull(),
  description: text("description").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  products: text("products"),
  faqs: text("faqs"),
  isActive: boolean("is_active").notNull().default(true),

  // Connection type: 'meta_cloud' | 'qr_session' | 'pending'
  connectionType: text("connection_type").notNull().default("pending"),

  // Meta Cloud API fields (nullable — only used when connectionType = 'meta_cloud')
  whatsappPhoneNumber: text("whatsapp_phone_number"),
  whatsappPhoneNumberId: text("whatsapp_phone_number_id"),
  whatsappAccessToken: text("whatsapp_access_token"),
  webhookVerifyToken: text("webhook_verify_token"),

  // QR Session fields (nullable — only used when connectionType = 'qr_session')
  sessionStatus: text("session_status"), // 'pending' | 'connected' | 'disconnected'
  connectedPhone: text("connected_phone"),

  // Owner — Firebase Auth UID of the user who created this business
  ownerUid: text("owner_uid"),

  // Advize Firebase store linkage
  firebaseUid: text("firebase_uid"),       // owner_id from Firestore stores collection
  upiId: text("upi_id"),                   // upi_id from Firestore store doc
  storeSlug: text("store_slug"),           // slug from Firestore store doc
  storeName: text("store_name"),           // store display name from Firestore
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBusinessSchema = createInsertSchema(businessesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBusiness = z.infer<typeof insertBusinessSchema>;
export type Business = typeof businessesTable.$inferSelect;
