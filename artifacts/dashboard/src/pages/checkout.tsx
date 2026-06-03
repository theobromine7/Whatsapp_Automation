import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { ArrowLeft, Crown, Zap, Check, Loader2, CheckCircle2, MessageSquare, ShieldCheck, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { customFetch } from "@workspace/api-client-react";
import { PLANS, type PlanId } from "./pricing";

// ─── Razorpay types ───────────────────────────────────────────────────────────
declare global {
  interface Window {
    Razorpay: new (opts: RazorpayOptions) => { open(): void };
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ─── Checkout Page ────────────────────────────────────────────────────────────

export default function Checkout() {
  const [, params] = useRoute("/checkout/:plan");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const planId = (params?.plan ?? "starter") as PlanId;
  const plan = PLANS.find((p) => p.id === planId) ?? PLANS[1]!;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);
  const [paymentId, setPaymentId] = useState("");

  const isPro = plan.id === "pro";
  const Icon = isPro ? Crown : plan.id === "starter" ? Zap : Gift;

  // Preload Razorpay script
  useEffect(() => { loadRazorpayScript(); }, []);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim()) return;
    setPaying(true);

    try {
      // 1. Load script (in case it wasn't ready yet)
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast({ title: "Error", description: "Could not load payment gateway. Check your network and try again.", variant: "destructive" });
        setPaying(false);
        return;
      }

      // 2. Create order on backend
      // customFetch throws ApiError on non-2xx, and returns the parsed body on success
      const order = await customFetch<{
        orderId: string;
        amount: number;
        currency: string;
        keyId: string;
        planLabel: string;
      }>("/api/payments/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, name, email, phone }),
      });

      // 3. Open Razorpay modal
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Wapp",
        description: order.planLabel,
        order_id: order.orderId,
        prefill: { name, email, contact: phone },
        theme: { color: "#00a884" },
        handler: async (response) => {
          try {
            // 4. Verify payment on backend — customFetch returns parsed body or throws
            const verified = await customFetch<{ verified: boolean; paymentId: string }>(
              "/api/payments/verify",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  plan: planId,
                }),
              },
            );

            if (verified.verified) {
              setPaymentId(verified.paymentId);
              setDone(true);
            } else {
              throw new Error("Signature mismatch");
            }
          } catch {
            toast({
              title: "Payment recorded but verification failed",
              description: `Please contact support with Payment ID: ${response.razorpay_payment_id}`,
              variant: "destructive",
            });
          }
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
      });

      rzp.open();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Payment failed", description: msg, variant: "destructive" });
      setPaying(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 bg-[#f0f2f5]">
        <div className="bg-white rounded-2xl border border-[#e9edef] p-8 max-w-sm w-full text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-[#111b21] mb-2">You're on {plan.name}!</h2>
          <p className="text-sm text-[#667781] mb-1">
            Payment confirmed. Your plan is now active.
          </p>
          {paymentId && (
            <p className="text-xs text-[#8696a0] font-mono mb-5">
              Payment ID: {paymentId}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Button className="w-full gap-2 bg-[#00a884] hover:bg-[#008f71] text-white border-0" onClick={() => setLocation("/inbox")}>
              <MessageSquare className="w-4 h-4" /> Go to Inbox
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setLocation("/dashboard")}>
              Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Checkout form ───────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto bg-[#f0f2f5]">
      {/* Header */}
      <div className="h-[60px] bg-[#f0f2f5] border-b border-[#e9edef] px-4 flex items-center gap-3 shrink-0">
        <Link href="/pricing">
          <button className="w-8 h-8 flex items-center justify-center rounded-full text-[#54656f] hover:bg-black/5 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="font-semibold text-[#111b21] text-base">Checkout</h1>
      </div>

      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <div className="grid md:grid-cols-5 gap-5 items-start">

          {/* ── Order Summary ── */}
          <div className="md:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border-2 border-[#e9edef] p-5">
              {/* Plan header */}
              <div className="flex items-center gap-3 mb-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", plan.accentBg)}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-[#111b21]">{plan.name} Plan</p>
                  {plan.badge && (
                    <Badge variant="outline" className={cn(
                      "text-[10px] mt-0.5",
                      isPro ? "border-[#00a884]/30 text-[#00a884] bg-[#00a884]/5" : "border-blue-200 text-blue-700 bg-blue-50"
                    )}>
                      {plan.badge}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="border-t border-[#f0f2f5] pt-4 mb-4">
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold text-[#111b21]">₹{plan.price}</span>
                  <span className="text-sm text-[#667781]">/month</span>
                </div>
                {plan.priceNote && (
                  <p className="text-xs text-[#8696a0]">{plan.priceNote}</p>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-2">
                {plan.features.filter((f) => f.included).map((f) => (
                  <li key={f.label} className="flex items-center gap-2">
                    <Check className={cn("w-3.5 h-3.5 shrink-0", plan.accentColor)} />
                    <span className="text-xs text-[#111b21]">
                      {f.label}
                      {f.value && <span className="text-[#8696a0] ml-1">· {f.value}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Security note */}
            <div className="flex items-center gap-2 px-1">
              <ShieldCheck className="w-4 h-4 text-[#00a884] shrink-0" />
              <p className="text-xs text-[#8696a0]">
                Payments secured by Razorpay. We never store your card details.
              </p>
            </div>
          </div>

          {/* ── Payment Form ── */}
          <div className="md:col-span-3">
            <form onSubmit={handlePay} className="bg-white rounded-2xl border border-[#e9edef] p-5 space-y-4">
              <div>
                <h2 className="font-semibold text-[#111b21] mb-1">Complete your purchase</h2>
                <p className="text-xs text-[#8696a0]">
                  You'll be taken to Razorpay's secure payment page.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#667781] mb-1.5">Full name</label>
                <Input
                  required
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={paying}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#667781] mb-1.5">Email address</label>
                <Input
                  required
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={paying}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#667781] mb-1.5">Phone number</label>
                <Input
                  required
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={paying}
                />
              </div>

              {/* Total */}
              <div className="bg-[#f8f9fa] rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-[#111b21]">Total due today</span>
                <span className="text-lg font-bold text-[#111b21]">₹{plan.price}</span>
              </div>

              <Button
                type="submit"
                className={cn(
                  "w-full gap-2 h-11 text-sm font-semibold",
                  isPro || plan.id === "starter"
                    ? "bg-[#00a884] hover:bg-[#008f71] text-white border-0"
                    : ""
                )}
                disabled={paying}
              >
                {paying ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Opening payment…</>
                ) : (
                  <>Pay ₹{plan.price} with Razorpay</>
                )}
              </Button>

              <p className="text-center text-xs text-[#8696a0]">
                By paying you agree to our{" "}
                <Link href="/terms">
                  <span className="text-primary hover:underline cursor-pointer">Terms of Service</span>
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
