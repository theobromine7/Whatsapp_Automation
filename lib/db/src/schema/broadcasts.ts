import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";

export const broadcastsTable = pgTable("business_broadcasts", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businessesTable.id, { onDelete: "cascade" }),
  triggerChunkId: integer("trigger_chunk_id"),
  message: text("message").notNull(),
  recipientCount: integer("recipient_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Broadcast = typeof broadcastsTable.$inferSelect;
export type NewBroadcast = typeof broadcastsTable.$inferInsert;
