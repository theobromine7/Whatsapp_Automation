import { Router, type IRouter, type Request } from "express";
import { createHmac } from "crypto";
import { eq } from "drizzle-orm";
import { db, userSubscriptionsTable, platformConfigTable } from "@workspace/db";
import { requireAuth } from "../lib/auth-middleware";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const RAZORPAY_BASE = "https://api.razorpay.com/v1";

const PLAN_AMOUNTS: Record<string, { amount: number; interval: number; label: string }> = {
  starter: { amount: 100,    interval: 1, label: "Wapp Starter Plan — ₹1/month"   },
  pro:     { amount: 99900,  interval: 1, label: "Wapp Pro Plan — ₹999/month"     },
};

function razorpayAuth(): string {
  const keyId     = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !keySecret) throw new Error("Razorpay credentials not configured");
  return "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

async function razorpayPost(path: string, body: unknown) {
  const res = await fetch(`${RAZORPAY_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: razorpayAuth() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Razorpay ${path} failed (${res.status}): ${errText}`);
  }
  return res.json();
}

async function razorpayDelete(path: string) {
  const res = await fetch(`${RAZORPAY_BASE}${path}`, {
    method: "DELETE",
    headers: { Authorization: razorpayAuth() },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Razorpay DELETE ${path} failed (${res.status}): ${errText}`);
  }
  return res.json();
}

async function getOrCreateRazorpayPlan(planId: string): Promise<string> {
  const configKey = `razorpay_plan_id_${planId}`;

  const [existing] = await db
    .select()
    .from(platformConfigTable)
    .where(eq(platformConfigTable.key, configKey));

  if (existing) return existing.value;

  const planInfo = PLAN_AMOUNTS[planId];
  if (!planInfo) throw new Error(`Unknown plan: ${planId}`);

  const plan = await razorpayPost("/plans", {
    period: "monthly",
    interval: planInfo.interval,
    item: {
      name: planInfo.label,
      amount: planInfo.amount,
      currency: "INR",
    },
  }) as { id: string };

  await db
    .insert(platformConfigTable)
    .values({ key: configKey, value: plan.id })
    .onConflictDoNothing();

  logger.info({ planId, razorpayPlanId: plan.id }, "Created Razorpay plan");
  return plan.id;
}

// ── POST /payments/subscriptions — create a recurring subscription ────────────
router.post("/payments/subscriptions", requireAuth, async (req, res): Promise<void> => {
  const { plan, name, email, phone } = req.body as {
    plan: string;
    name?: string;
    email?: string;
    phone?: string;
  };

  if (!PLAN_AMOUNTS[plan]) {
    res.status(400).json({ error: `Unknown plan: ${plan}` });
    return;
  }

  try {
    const razorpayPlanId = await getOrCreateRazorpayPlan(plan);

    const subscription = await razorpayPost("/subscriptions", {
      plan_id: razorpayPlanId,
      total_count: 120,
      quantity: 1,
      notes: {
        plan,
        ownerUid: req.user!.uid,
        name:  name  ?? "",
        email: email ?? "",
        phone: phone ?? "",
      },
      notify_info: email
        ? { notify_phone: phone ?? "", notify_email: email }
        : undefined,
    }) as { id: string };

    await db
      .insert(userSubscriptionsTable)
      .values({
        ownerUid: req.user!.uid,
        planId: plan,
        razorpaySubscriptionId: subscription.id,
        razorpayPlanId,
        status: "created",
      })
      .onConflictDoUpdate({
        target: userSubscriptionsTable.ownerUid,
        set: {
          planId: plan,
          razorpaySubscriptionId: subscription.id,
          razorpayPlanId,
          status: "created",
          currentPeriodStart: null,
          currentPeriodEnd: null,
        },
      });

    logger.info({ plan, subscriptionId: subscription.id, uid: req.user!.uid }, "Razorpay subscription created");

    const keyId = process.env["RAZORPAY_KEY_ID"]!;
    res.json({
      subscriptionId: subscription.id,
      keyId,
      plan,
      planLabel: PLAN_AMOUNTS[plan]!.label,
      isTestMode: keyId.startsWith("rzp_test_"),
    });
  } catch (err) {
    logger.error({ err }, "Failed to create Razorpay subscription");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to create subscription" });
  }
});

// ── POST /payments/subscriptions/verify — verify mandate + first payment ──────
router.post("/payments/subscriptions/verify", requireAuth, async (req, res): Promise<void> => {
  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body as {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
  };

  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keySecret) {
    res.status(500).json({ error: "Razorpay not configured" });
    return;
  }

  const expectedSig = createHmac("sha256", keySecret)
    .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
    .digest("hex");

  if (expectedSig !== razorpay_signature) {
    logger.warn({ razorpay_subscription_id }, "Subscription signature mismatch");
    res.status(400).json({ error: "Payment verification failed — signature mismatch" });
    return;
  }

  await db
    .update(userSubscriptionsTable)
    .set({ status: "authenticated" })
    .where(eq(userSubscriptionsTable.ownerUid, req.user!.uid));

  logger.info({ razorpay_payment_id, razorpay_subscription_id }, "Subscription verified");
  res.json({ verified: true, paymentId: razorpay_payment_id, subscriptionId: razorpay_subscription_id });
});

// ── GET /payments/subscriptions/status — get user's current subscription ──────
router.get("/payments/subscriptions/status", requireAuth, async (req, res): Promise<void> => {
  const [sub] = await db
    .select()
    .from(userSubscriptionsTable)
    .where(eq(userSubscriptionsTable.ownerUid, req.user!.uid));

  if (!sub) {
    res.json({ plan: "free", status: "none" });
    return;
  }

  res.json({
    plan: sub.planId,
    status: sub.status,
    subscriptionId: sub.razorpaySubscriptionId,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
  });
});

// ── DELETE /payments/subscriptions — cancel the subscription ──────────────────
router.delete("/payments/subscriptions", requireAuth, async (req, res): Promise<void> => {
  const [sub] = await db
    .select()
    .from(userSubscriptionsTable)
    .where(eq(userSubscriptionsTable.ownerUid, req.user!.uid));

  if (!sub) {
    res.status(404).json({ error: "No active subscription found" });
    return;
  }

  try {
    await razorpayDelete(`/subscriptions/${sub.razorpaySubscriptionId}/cancel`);

    await db
      .update(userSubscriptionsTable)
      .set({ status: "cancelled" })
      .where(eq(userSubscriptionsTable.ownerUid, req.user!.uid));

    logger.info({ subscriptionId: sub.razorpaySubscriptionId, uid: req.user!.uid }, "Subscription cancelled");
    res.json({ cancelled: true });
  } catch (err) {
    logger.error({ err }, "Failed to cancel subscription");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to cancel subscription" });
  }
});

// ── POST /payments/webhook — Razorpay webhook (no auth, HMAC-verified) ────────
router.post("/payments/webhook", async (req: Request & { rawBody?: Buffer }, res): Promise<void> => {
  const webhookSecret = process.env["RAZORPAY_WEBHOOK_SECRET"];

  if (webhookSecret) {
    const signature = req.headers["x-razorpay-signature"] as string | undefined;
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
    const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
    if (!signature || expected !== signature) {
      logger.warn("Razorpay webhook signature mismatch");
      res.status(400).json({ error: "Invalid signature" });
      return;
    }
  } else {
    logger.warn("RAZORPAY_WEBHOOK_SECRET not set — skipping webhook signature verification");
  }

  const event = req.body as {
    event: string;
    payload?: {
      subscription?: { entity?: { id?: string; status?: string; current_start?: number; current_end?: number } };
      payment?: { entity?: { id?: string } };
    };
  };

  const subEntity = event.payload?.subscription?.entity;
  const subId = subEntity?.id;

  if (!subId) {
    res.json({ ok: true });
    return;
  }

  logger.info({ event: event.event, subscriptionId: subId }, "Razorpay webhook received");

  const statusMap: Record<string, string> = {
    "subscription.activated":  "active",
    "subscription.charged":    "active",
    "subscription.halted":     "halted",
    "subscription.cancelled":  "cancelled",
    "subscription.completed":  "completed",
    "subscription.pending":    "pending",
    "subscription.authenticated": "authenticated",
  };

  const newStatus = statusMap[event.event];
  if (newStatus) {
    const updates: Record<string, unknown> = { status: newStatus };
    if (subEntity?.current_start) updates.currentPeriodStart = new Date(subEntity.current_start * 1000);
    if (subEntity?.current_end)   updates.currentPeriodEnd   = new Date(subEntity.current_end   * 1000);

    await db
      .update(userSubscriptionsTable)
      .set(updates as Parameters<typeof db.update>[0])
      .where(eq(userSubscriptionsTable.razorpaySubscriptionId, subId));

    logger.info({ subscriptionId: subId, status: newStatus }, "Subscription status updated from webhook");
  }

  res.json({ ok: true });
});

export default router;
