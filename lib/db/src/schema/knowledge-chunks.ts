import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";

const vector = customType<{ data: number[]; driverData: string }>({
  dataType(config: { dimensions: number } | undefined) {
    const dims = config?.dimensions ?? 768;
    return `vector(${dims})`;
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map(Number);
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
});

export const knowledgeChunksTable = pgTable(
  "business_knowledge_chunks",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    sourceType: text("source_type").notNull().default("document"),
    embedding: vector("embedding", { dimensions: 768 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("knowledge_chunks_business_id_idx").on(table.businessId)]
);

export const insertKnowledgeChunkSchema = createInsertSchema(knowledgeChunksTable).omit({
  id: true,
  embedding: true,
  createdAt: true,
});

export type KnowledgeChunk = typeof knowledgeChunksTable.$inferSelect;
export type InsertKnowledgeChunk = z.infer<typeof insertKnowledgeChunkSchema>;
