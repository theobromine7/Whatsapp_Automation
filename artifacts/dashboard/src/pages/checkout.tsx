import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { ArrowLeft, Crown, Zap, Check, Loader2, CheckCircle2, MessageSquare, ShieldCheck, Gift, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { customFetch } from "@workspace/api-client-react";
import { PLANS, type PlanId } from "./pricing";

declare global {
  interface Window {
    Razorpay: new (opts: RazorpaySubscriptionOptions) => RazorpayInstance;
  }
}

interface RazorpayInstance {
  open(): void;
  on(event: string, cb: (response: { error?: { code?: string; description?: string; reason?: string } }) => void): void;
}

interface RazorpaySubscriptionOptions {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void; escape?: boolean };
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

export default function Checkout() {
  const [, params] = useRoute("/checkout/:plan");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const planId = (params?.plan ?? "starter") as PlanId;
  const plan = PLANS.find((p) => p.id === planId) ?? PLANS[1]!;

  const [upiId, setUpiId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState("");

  const isPro = plan.id === "pro";
  const Icon = isPro ? Crown : plan.id === "starter" ? Zap : Gift;

  useEffect(() => { loadRazorpayScript(); }, []);

  const upiValid = /^[\w.\-]+@[\w.\-]+$/.test(upiId.trim());

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upiId.trim() || !upiValid) return;
    setPaying(true);

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast({ title: "Error", description: "Could not load payment gateway. Check your network and try again.", variant: "destructive" });
        setPaying(false);
        return;
      }

      const sub = await customFetch<{
        subscriptionId: string;
        keyId: string;
        planLabel: string;
      }>("/api/payments/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, name, email }),
      });

      let paymentSucceeded = false;
      let rzpError: string | null = null;

      const rzp = new window.Razorpay({
        key: sub.keyId,
        subscription_id: sub.subscriptionId,
        name: "Advize Technologies",
        description: `Wapp – ${sub.planLabel}`,
        prefill: { name, email, vpa: upiId.trim() },
        theme: { color: "#00a884" },
        handler: async (response) => {
          paymentSucceeded = true;
          try {
            const verified = await customFetch<{ verified: boolean; subscriptionId: string }>(
              "/api/payments/subscriptions/verify",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_subscription_id: response.razorpay_subscription_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              },
            );

            if (verified.verified) {
              setSubscriptionId(verified.subscriptionId);
              setDone(true);
            } else {
              throw new Error("Signature mismatch");
            }
          } catch {
            toast({
              title: "Mandate set up but verification failed",
              description: `Contact support with Subscription ID: ${response.razorpay_subscription_id}`,
              variant: "destructive",
            });
          }
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
            if (!paymentSucceeded) {
              if (rzpError) {
                toast({
                  title: "Payment failed",
                  description: rzpError,
                  variant: "destructive",
                });
              }
            }
          },
        },
      });

      rzp.on("payment.failed", (response) => {
        rzpError = response.error?.description
          ?? response.error?.reason
          ?? "Payment failed. Please try a different payment method.";
      });

      rzp.open();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Subscription failed", description: msg, variant: "destructive" });
      setPaying(false);
    }
  };

  if (done) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 bg-[#f0f2f5]">
        <div className="bg-white rounded-2xl border border-[#e9edef] p-8 max-w-sm w-full text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-[#111b21] mb-2">AutoPay Activated! 🎉</h2>
          <p className="text-sm text-[#667781] mb-1">
            Your <strong>{plan.name}</strong> plan is now active. You'll be charged ₹{plan.price}/month automatically — just like Netflix.
          </p>
          {subscriptionId && (
            <p className="text-xs text-[#8696a0] font-mono mb-5 break-all">
              Subscription: {subscriptionId}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Button className="w-full gap-2 bg-[#00a884] hover:bg-[#008f71] text-white border-0" onClick={() => setLocation("/inbox")}>
              <MessageSquare className="w-4 h-4" /> Go to Inbox
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setLocation("/settings")}>
              Manage Subscription
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#f0f2f5]">
      <div className="h-[60px] bg-[#f0f2f5] border-b border-[#e9edef] px-4 flex items-center gap-3 shrink-0">
        <Link href="/pricing">
          <button className="w-8 h-8 flex items-center justify-center rounded-full text-[#54656f] hover:bg-black/5 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="font-semibold text-[#111b21] text-base">Set Up AutoPay</h1>
      </div>

      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <div className="grid md:grid-cols-5 gap-5 items-start">

          <div className="md:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border-2 border-[#e9edef] p-5">
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

              <div className="border-t border-[#f0f2f5] pt-4 mb-4">
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold text-[#111b21]">₹{plan.price}</span>
                  <span className="text-sm text-[#667781]">/month</span>
                </div>
                {plan.priceNote && (
                  <p className="text-xs text-[#8696a0]">{plan.priceNote}</p>
                )}
              </div>

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

            <div className="bg-[#f0fdf8] border border-[#bbf7d0] rounded-xl p-3.5 flex items-start gap-2.5">
              <RefreshCw className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-emerald-800">How UPI AutoPay works</p>
                <ol className="text-xs text-emerald-700 mt-1 space-y-1 leading-relaxed list-none">
                  <li>1. Enter your UPI ID below</li>
                  <li>2. You'll get a mandate request on your UPI app (PhonePe / GPay / Paytm) from <strong>Advize Technologies</strong></li>
                  <li>3. Approve once — billing is automatic every month</li>
                  <li>4. Cancel anytime from Settings</li>
                </ol>
              </div>
            </div>

            <div className="flex items-center gap-2 px-1">
              <ShieldCheck className="w-4 h-4 text-[#00a884] shrink-0" />
              <p className="text-xs text-[#8696a0]">
                Payments secured by Razorpay. We never store your card details.
              </p>
            </div>
          </div>

          <div className="md:col-span-3">
            <form onSubmit={handleSubscribe} className="bg-white rounded-2xl border border-[#e9edef] p-5 space-y-4">
              <div>
                <h2 className="font-semibold text-[#111b21] mb-1">Enter your UPI ID</h2>
                <p className="text-xs text-[#8696a0]">
                  Razorpay will send an AutoPay mandate request to this UPI ID on behalf of <strong>Advize Technologies</strong>. Approve it in your UPI app to complete setup.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#667781] mb-1.5">
                  UPI ID <span className="text-[#8696a0] font-normal">(e.g. yourname@okaxis, 98765@ybl)</span>
                </label>
                <Input
                  required
                  placeholder="yourname@okaxis"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  disabled={paying}
                  className={cn(
                    upiId.trim() && !upiValid && "border-red-400 focus-visible:ring-red-400"
                  )}
                />
                {upiId.trim() && !upiValid && (
                  <p className="text-xs text-red-500 mt-1">Please enter a valid UPI ID (e.g. name@okaxis)</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#667781] mb-1.5">Name <span className="text-[#8696a0] font-normal">(optional)</span></label>
                  <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} disabled={paying} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#667781] mb-1.5">Email <span className="text-[#8696a0] font-normal">(for receipt)</span></label>
                  <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={paying} />
                </div>
              </div>

              <div className="bg-[#f8f9fa] rounded-xl px-4 py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#111b21]">First charge today</span>
                  <span className="text-lg font-bold text-[#111b21]">₹{plan.price}</span>
                </div>
                <p className="text-xs text-[#8696a0]">Then ₹{plan.price}/month automatically via UPI AutoPay</p>
              </div>

              <Button
                type="submit"
                className={cn(
                  "w-full gap-2 h-11 text-sm font-semibold",
                  "bg-[#00a884] hover:bg-[#008f71] text-white border-0"
                )}
                disabled={paying || !upiValid}
              >
                {paying ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending mandate request…</>
                ) : (
                  <><RefreshCw className="w-4 h-4" /> Set Up AutoPay — ₹{plan.price}/mo</>
                )}
              </Button>

              <p className="text-center text-xs text-[#8696a0]">
                By subscribing you agree to our{" "}
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
