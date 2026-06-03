import { Router, type IRouter } from "express";
import { createHmac } from "crypto";
import { requireAuth } from "../lib/auth-middleware";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const RAZORPAY_BASE = "https://api.razorpay.com/v1";

const PLAN_AMOUNTS: Record<string, { amount: number; label: string }> = {
  starter: { amount: 39900, label: "Wapp Starter Plan" },
  pro:     { amount: 99900, label: "Wapp Pro Plan"     },
};

function razorpayAuth(): string {
  const keyId     = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !keySecret) throw new Error("Razorpay credentials not configured");
  return "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

// ── POST /payments/orders — create a Razorpay order ──────────────────────────
router.post("/payments/orders", requireAuth, async (req, res): Promise<void> => {
  const { plan, name, email, phone } = req.body as {
    plan: string;
    name?: string;
    email?: string;
    phone?: string;
  };

  const planInfo = PLAN_AMOUNTS[plan];
  if (!planInfo) {
    res.status(400).json({ error: `Unknown plan: ${plan}` });
    return;
  }

  try {
    const auth = razorpayAuth();
    const response = await fetch(`${RAZORPAY_BASE}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body: JSON.stringify({
        amount: planInfo.amount,
        currency: "INR",
        receipt: `wapp_${plan}_${Date.now()}`,
        notes: {
          plan,
          name:     name ?? "",
          email:    email ?? "",
          phone:    phone ?? "",
          ownerUid: req.user!.uid,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error({ status: response.status, errText }, "Razorpay order creation failed");
      res.status(502).json({ error: "Payment provider error. Check Razorpay credentials." });
      return;
    }

    const order = await response.json() as { id: string; amount: number; currency: string };
    logger.info({ plan, orderId: order.id }, "Razorpay order created");

    res.json({
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
      keyId:    process.env["RAZORPAY_KEY_ID"],
      plan,
      planLabel: planInfo.label,
    });
  } catch (err) {
    logger.error({ err }, "Failed to create Razorpay order");
    res.status(500).json({ error: "Failed to create payment order" });
  }
});

// ── POST /payments/verify — verify Razorpay signature after payment ───────────
router.post("/payments/verify", requireAuth, async (req, res): Promise<void> => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body as {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    plan?: string;
  };

  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keySecret) {
    res.status(500).json({ error: "Razorpay not configured on server" });
    return;
  }

  const expectedSig = createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSig !== razorpay_signature) {
    logger.warn({ razorpay_order_id }, "Razorpay signature mismatch — possible fraud attempt");
    res.status(400).json({ error: "Payment verification failed — signature mismatch" });
    return;
  }

  logger.info({ razorpay_order_id, razorpay_payment_id, plan }, "Payment verified successfully");

  // TODO: persist subscription to DB and activate plan for req.user!.uid
  res.json({ verified: true, paymentId: razorpay_payment_id, plan });
});

export default router;
