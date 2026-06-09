import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const userSubscriptionsTable = pgTable("user_subscriptions", {
  id: serial("id").primaryKey(),
  ownerUid: text("owner_uid").notNull().unique(),
  planId: text("plan_id").notNull(),
  razorpaySubscriptionId: text("razorpay_subscription_id").notNull().unique(),
  razorpayPlanId: text("razorpay_plan_id").notNull(),
  status: text("status").notNull().default("created"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const platformConfigTable = pgTable("platform_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserSubscription = typeof userSubscriptionsTable.$inferSelect;
