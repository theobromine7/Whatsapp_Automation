import { useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { ArrowLeft, Crown, Zap, Check, Copy, Loader2, CheckCircle2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PLANS, type PlanId } from "./pricing";

// ─── UPI Details (replace with real UPI ID) ──────────────────────────────────
const UPI_ID = "wapp@upi";
const UPI_NAME = "Wapp Technologies";

function buildUpiLink(amount: number, plan: string) {
  const note = encodeURIComponent(`Wapp ${plan} plan subscription`);
  const name = encodeURIComponent(UPI_NAME);
  return `upi://pay?pa=${UPI_ID}&pn=${name}&am=${amount}&tn=${note}&cu=INR`;
}

// ─── Checkout Page ────────────────────────────────────────────────────────────

export default function Checkout() {
  const [, params] = useRoute("/checkout/:plan");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const planId = (params?.plan ?? "starter") as PlanId;
  const plan = PLANS.find((p) => p.id === planId) ?? PLANS[1]!;

  const [step, setStep] = useState<"details" | "payment" | "confirm" | "done">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [utr, setUtr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const Icon = plan.id === "pro" ? Crown : Zap;

  const copyUpi = () => {
    navigator.clipboard.writeText(UPI_ID);
    toast({ title: "Copied!", description: `${UPI_ID} copied to clipboard.` });
  };

  const handleDetailsNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim()) return;
    setStep("payment");
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utr.trim()) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSubmitting(false);
    setStep("done");
  };

  if (step === "done") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 text-center bg-[#f0f2f5]">
        <div className="bg-white rounded-2xl border border-[#e9edef] p-8 max-w-sm w-full shadow-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-[#111b21] mb-2">Payment received!</h2>
          <p className="text-sm text-[#667781] mb-1">
            Thank you, <strong>{name}</strong>. We've received your payment details.
          </p>
          <p className="text-sm text-[#667781] mb-5">
            Your <strong>{plan.name}</strong> plan will be activated within <strong>2 hours</strong>. We'll send a confirmation to <strong>{email}</strong>.
          </p>
          <div className="flex flex-col gap-2">
            <Button className="w-full gap-2" onClick={() => setLocation("/inbox")}>
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

  return (
    <div className="flex-1 overflow-y-auto bg-[#f0f2f5]">
      {/* Header */}
      <div className="h-[60px] bg-[#f0f2f5] border-b border-[#e9edef] px-4 flex items-center gap-3 shrink-0">
        <Link href="/pricing">
          <button className="w-8 h-8 flex items-center justify-center rounded-full text-[#54656f] hover:bg-black/5">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="font-semibold text-[#111b21] text-base">Checkout</h1>
      </div>

      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <div className="grid md:grid-cols-5 gap-5">
          {/* ── Order Summary (left / top on mobile) ── */}
          <div className="md:col-span-2">
            <div className={cn(
              "rounded-2xl p-5 border-2",
              plan.id === "pro" ? "bg-[#111b21] border-[#00a884] text-white" : "bg-white border-[#e9edef]"
            )}>
              <div className="flex items-center gap-3 mb-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", plan.id === "pro" ? "bg-[#00a884]" : "bg-blue-500")}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className={cn("font-bold text-base", plan.id === "pro" ? "text-white" : "text-[#111b21]")}>
                    {plan.name} Plan
                  </p>
                  {plan.badge && (
                    <Badge variant="outline" className={cn("text-[10px] mt-0.5", plan.badgeColor)}>
                      {plan.badge}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="border-t border-white/10 md:border-[#e9edef] pt-4 mb-4">
                <div className="flex items-baseline gap-1 mb-1">
                  <span className={cn("text-3xl font-bold", plan.id === "pro" ? "text-white" : "text-[#111b21]")}>
                    ₹{plan.price}
                  </span>
                  <span className={cn("text-sm", plan.id === "pro" ? "text-white/60" : "text-[#667781]")}>/month</span>
                </div>
                {plan.priceNote && (
                  <p className={cn("text-xs", plan.id === "pro" ? "text-[#8696a0]" : "text-[#8696a0]")}>
                    {plan.priceNote}
                  </p>
                )}
              </div>
              <ul className="space-y-2">
                {plan.features.filter((f) => f.included).slice(0, 6).map((f) => (
                  <li key={f.label} className="flex items-center gap-2">
                    <Check className={cn("w-3.5 h-3.5 shrink-0", plan.id === "pro" ? "text-[#00a884]" : "text-emerald-500")} />
                    <span className={cn("text-xs", plan.id === "pro" ? "text-white/80" : "text-[#111b21]")}>
                      {f.label}
                      {typeof f.value === "string" && (
                        <span className={cn("ml-1", plan.id === "pro" ? "text-white/50" : "text-[#667781]")}>· {f.value}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Progress steps */}
            <div className="flex items-center gap-2 mt-4 px-1">
              {(["details", "payment", "confirm"] as const).map((s, i) => (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    step === s ? "bg-primary text-white" :
                    (["details","payment","confirm"].indexOf(step) > i) ? "bg-emerald-500 text-white" : "bg-[#e9edef] text-[#8696a0]"
                  )}>
                    {["details","payment","confirm"].indexOf(step) > i ? <Check className="w-3 h-3" /> : i + 1}
                  </div>
                  <span className="text-[10px] text-[#667781] capitalize">{s}</span>
                  {i < 2 && <div className="flex-1 h-px bg-[#e9edef]" />}
                </div>
              ))}
            </div>
          </div>

          {/* ── Form (right / bottom on mobile) ── */}
          <div className="md:col-span-3">
            {step === "details" && (
              <form onSubmit={handleDetailsNext} className="bg-white rounded-2xl border border-[#e9edef] p-5 space-y-4">
                <h2 className="font-semibold text-[#111b21]">Your details</h2>
                <div>
                  <label className="block text-xs font-medium text-[#667781] mb-1.5">Full name</label>
                  <Input
                    required
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
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
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#667781] mb-1.5">WhatsApp / Phone number</label>
                  <Input
                    required
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full gap-2 mt-2">
                  Continue to payment <ArrowLeft className="w-4 h-4 rotate-180" />
                </Button>
              </form>
            )}

            {step === "payment" && (
              <div className="bg-white rounded-2xl border border-[#e9edef] p-5 space-y-5">
                <h2 className="font-semibold text-[#111b21]">Pay via UPI</h2>
                <p className="text-sm text-[#667781]">
                  Send <strong className="text-[#111b21]">₹{plan.price}</strong> to the UPI ID below using any UPI app (GPay, PhonePe, Paytm, etc.)
                </p>

                {/* UPI ID box */}
                <div className="bg-[#f0f2f5] rounded-xl p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-[#667781] mb-0.5">UPI ID</p>
                    <p className="font-mono font-semibold text-[#111b21] text-sm">{UPI_ID}</p>
                    <p className="text-xs text-[#667781] mt-0.5">{UPI_NAME}</p>
                  </div>
                  <button
                    onClick={copyUpi}
                    className="w-9 h-9 rounded-xl bg-white border border-[#e9edef] flex items-center justify-center text-[#667781] hover:text-primary hover:border-primary/40 transition-colors shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                {/* Open in UPI app */}
                <a
                  href={buildUpiLink(plan.price!, plan.name)}
                  className="flex items-center justify-center gap-2 w-full bg-[#00a884] hover:bg-[#008f71] text-white rounded-xl py-3 text-sm font-semibold transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Open in UPI App
                </a>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#e9edef]" /></div>
                  <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-[#8696a0]">After paying</span></div>
                </div>

                <Button className="w-full gap-2" onClick={() => setStep("confirm")}>
                  I've paid, enter UTR <ArrowLeft className="w-4 h-4 rotate-180" />
                </Button>
                <button className="w-full text-xs text-[#667781] hover:text-primary transition-colors" onClick={() => setStep("details")}>
                  ← Back
                </button>
              </div>
            )}

            {step === "confirm" && (
              <form onSubmit={handleConfirm} className="bg-white rounded-2xl border border-[#e9edef] p-5 space-y-4">
                <h2 className="font-semibold text-[#111b21]">Confirm payment</h2>
                <p className="text-sm text-[#667781]">
                  Enter the 12-digit UTR / transaction reference number shown in your UPI app after payment.
                </p>
                <div>
                  <label className="block text-xs font-medium text-[#667781] mb-1.5">UTR / Transaction ID</label>
                  <Input
                    required
                    placeholder="e.g. 412345678901"
                    value={utr}
                    onChange={(e) => setUtr(e.target.value)}
                    className="font-mono"
                  />
                  <p className="text-[10px] text-[#8696a0] mt-1">Found in your UPI app under payment history.</p>
                </div>
                <div className="bg-[#f0f2f5] rounded-xl p-3 text-xs text-[#667781] space-y-0.5">
                  <p><span className="font-medium text-[#111b21]">Name:</span> {name}</p>
                  <p><span className="font-medium text-[#111b21]">Email:</span> {email}</p>
                  <p><span className="font-medium text-[#111b21]">Plan:</span> {plan.name} — ₹{plan.price}/month</p>
                </div>
                <Button type="submit" className="w-full gap-2" disabled={submitting}>
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : "Confirm & Activate Plan →"}
                </Button>
                <button type="button" className="w-full text-xs text-[#667781] hover:text-primary transition-colors" onClick={() => setStep("payment")}>
                  ← Back
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
