import { useLocation } from "wouter";
import { Check, X, Zap, Crown, Gift, ArrowRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Plan data ────────────────────────────────────────────────────────────────

export type PlanId = "free" | "starter" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  price: number | null;
  priceNote?: string;
  badge?: string;
  badgeColor?: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  cta: string;
  ctaVariant: "outline" | "default" | "secondary";
  ctaPrimary?: boolean;
  features: { label: string; value: string | boolean; included: boolean }[];
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description: "Try the full platform with no credit card required.",
    icon: Gift,
    iconBg: "bg-emerald-500",
    cta: "Start for Free",
    ctaVariant: "outline",
    features: [
      { label: "AI replies", value: "30 / month", included: true },
      { label: "Daily outgoing messages", value: "5 / day", included: true },
      { label: "Daily broadcasts", value: false, included: false },
      { label: "New contacts / day", value: "3 / day", included: true },
      { label: "Follow-ups", value: false, included: false },
      { label: "WhatsApp QR connection", value: "Included", included: true },
      { label: "No Meta developer account", value: "Required", included: true },
      { label: "Official Meta Cloud API", value: false, included: false },
      { label: "Unlimited messages", value: false, included: false },
      { label: "Priority support", value: false, included: false },
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: 399,
    badge: "QR Only",
    badgeColor: "border-blue-300 text-blue-700 bg-blue-50",
    description: "Connect via QR scan. No Meta account needed. Perfect for small businesses.",
    icon: Zap,
    iconBg: "bg-blue-500",
    cta: "Get Started",
    ctaVariant: "default",
    features: [
      { label: "AI replies", value: "Unlimited", included: true },
      { label: "Daily outgoing messages", value: "50 / day", included: true },
      { label: "Daily broadcasts", value: "20 / day", included: true },
      { label: "New contacts / day", value: "10 / day", included: true },
      { label: "Follow-ups", value: "Enabled", included: true },
      { label: "WhatsApp QR connection", value: "Included", included: true },
      { label: "No Meta developer account", value: "Required", included: true },
      { label: "Official Meta Cloud API", value: false, included: false },
      { label: "Unlimited messages", value: false, included: false },
      { label: "Priority support", value: false, included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 999,
    priceNote: "+ WhatsApp message fees (pay-as-you-go)",
    badge: "Most Popular",
    badgeColor: "bg-[#00a884] text-white border-[#00a884]",
    description: "Official Meta Cloud API. Unlimited messages. Enterprise-grade reliability.",
    icon: Crown,
    iconBg: "bg-[#00a884]",
    cta: "Get Started",
    ctaVariant: "default",
    ctaPrimary: true,
    features: [
      { label: "AI replies", value: "Unlimited", included: true },
      { label: "Daily outgoing messages", value: "Unlimited", included: true },
      { label: "Daily broadcasts", value: "Unlimited", included: true },
      { label: "New contacts / day", value: "Unlimited", included: true },
      { label: "Follow-ups", value: "Enabled", included: true },
      { label: "Official Meta Cloud API", value: "Included", included: true },
      { label: "WhatsApp QR connection", value: "Included", included: true },
      { label: "Pay-as-you-go WhatsApp fees", value: "~₹0.50–₹1/msg", included: true },
      { label: "Unlimited messages", value: "Unlimited", included: true },
      { label: "Priority support", value: "Included", included: true },
    ],
  },
];

// ─── Comparison table rows ─────────────────────────────────────────────────────

const COMPARISON_ROWS = [
  { label: "Monthly price", free: "Free", starter: "₹399", pro: "₹999" },
  { label: "AI replies", free: "30 / month", starter: "Unlimited", pro: "Unlimited" },
  { label: "Outgoing messages / day", free: "5", starter: "50", pro: "Unlimited" },
  { label: "Broadcasts / day", free: "—", starter: "20", pro: "Unlimited" },
  { label: "New contacts / day", free: "3", starter: "10", pro: "Unlimited" },
  { label: "Follow-ups", free: "—", starter: "✓", pro: "✓" },
  { label: "WhatsApp QR connection", free: "✓", starter: "✓", pro: "✓" },
  { label: "Meta Cloud API", free: "—", starter: "—", pro: "✓" },
  { label: "Priority support", free: "—", starter: "—", pro: "✓" },
];

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({ plan, onSelect }: { plan: Plan; onSelect: (id: PlanId) => void }) {
  const isPro = plan.id === "pro";
  const Icon = plan.icon;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border-2 p-6 transition-all",
        isPro
          ? "bg-[#111b21] border-[#00a884] text-white shadow-2xl"
          : "bg-white border-[#e9edef] hover:border-primary/40 hover:shadow-md"
      )}
    >
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className={cn("text-xs font-semibold px-3 py-1 rounded-full border", plan.badgeColor)}>
            {plan.badge}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", plan.iconBg)}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <span className={cn("font-bold text-lg", isPro ? "text-white" : "text-[#111b21]")}>
            {plan.name}
          </span>
        </div>
        {plan.badge && plan.id === "starter" && (
          <Badge variant="outline" className={cn("text-[10px]", plan.badgeColor)}>{plan.badge}</Badge>
        )}
      </div>

      {/* Price */}
      <div className="mb-2">
        {plan.price === 0 ? (
          <div className={cn("text-4xl font-bold", isPro ? "text-white" : "text-[#111b21]")}>Free</div>
        ) : (
          <div className="flex items-end gap-1">
            <span className={cn("text-4xl font-bold", isPro ? "text-white" : "text-[#111b21]")}>
              ₹{plan.price}
            </span>
            <span className={cn("text-sm mb-1.5", isPro ? "text-white/60" : "text-[#667781]")}>/month</span>
          </div>
        )}
        {plan.priceNote && (
          <p className={cn("text-xs mt-1", isPro ? "text-[#8696a0]" : "text-[#667781]")}>{plan.priceNote}</p>
        )}
      </div>

      <p className={cn("text-sm mb-5", isPro ? "text-[#8696a0]" : "text-[#667781]")}>{plan.description}</p>

      {/* CTA */}
      <Button
        className={cn(
          "w-full gap-2 mb-5",
          isPro
            ? "bg-[#00a884] hover:bg-[#008f71] text-white border-0"
            : plan.id === "free"
            ? ""
            : ""
        )}
        variant={plan.ctaVariant}
        onClick={() => onSelect(plan.id)}
      >
        {plan.cta} <ArrowRight className="w-4 h-4" />
      </Button>

      {/* Features */}
      <ul className="space-y-2.5">
        {plan.features.map((f) => (
          <li key={f.label} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {f.included ? (
                <Check className={cn("w-3.5 h-3.5 shrink-0", isPro ? "text-[#00a884]" : "text-emerald-500")} />
              ) : (
                <X className={cn("w-3.5 h-3.5 shrink-0", isPro ? "text-white/30" : "text-[#c4c4c4]")} />
              )}
              <span className={cn("text-xs truncate", isPro ? (f.included ? "text-white/90" : "text-white/40") : (f.included ? "text-[#111b21]" : "text-[#8696a0]"))}>
                {f.label}
              </span>
            </div>
            {f.included && typeof f.value === "string" && (
              <span className={cn("text-xs font-medium shrink-0", isPro ? "text-[#8696a0]" : "text-[#667781]")}>
                {f.value}
              </span>
            )}
            {!f.included && (
              <span className={cn("text-xs shrink-0", isPro ? "text-white/30" : "text-[#c4c4c4]")}>
                Not included
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Main Pricing Page ────────────────────────────────────────────────────────

export default function Pricing() {
  const [, setLocation] = useLocation();

  const handleSelect = (planId: PlanId) => {
    if (planId === "free") {
      setLocation("/dashboard");
    } else {
      setLocation(`/checkout/${planId}`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f0f2f5]">
      {/* Header */}
      <div className="h-[60px] bg-[#f0f2f5] border-b border-[#e9edef] px-4 md:px-6 flex items-center shrink-0">
        <h1 className="font-semibold text-[#111b21] text-base">Pricing</h1>
      </div>

      <div className="px-4 py-8 max-w-5xl mx-auto">
        {/* Hero text */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium mb-3">
            <Star className="w-3 h-3" /> Simple, transparent pricing
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-[#111b21]">
            Pick the plan that fits your business.
          </h2>
          <p className="text-[#667781] mt-2 text-sm md:text-base">
            Upgrade anytime. No lock-in contracts.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onSelect={handleSelect} />
          ))}
        </div>

        {/* Full comparison table */}
        <div className="bg-white rounded-2xl border border-[#e9edef] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e9edef]">
            <h3 className="font-semibold text-[#111b21]">Full Comparison</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e9edef] bg-[#f8f9fa]">
                  <th className="text-left px-6 py-3 text-[#667781] font-medium">Feature</th>
                  <th className="text-center px-4 py-3 text-[#667781] font-medium">Free</th>
                  <th className="text-center px-4 py-3 text-[#667781] font-medium">Starter</th>
                  <th className="text-center px-4 py-3 text-primary font-semibold">Pro</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr key={row.label} className={cn("border-b border-[#f0f2f5]", i % 2 === 0 ? "bg-white" : "bg-[#fafafa]")}>
                    <td className="px-6 py-3 text-[#111b21] font-medium">{row.label}</td>
                    <td className="px-4 py-3 text-center text-[#667781]">{row.free}</td>
                    <td className="px-4 py-3 text-center text-[#667781]">{row.starter}</td>
                    <td className="px-4 py-3 text-center text-primary font-medium">{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-[#f8f9fa] flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-[#667781]">All plans include a WhatsApp AI bot, inbox, and conversation history.</p>
            <Button size="sm" onClick={() => handleSelect("pro")} className="gap-2 shrink-0">
              <Crown className="w-3.5 h-3.5" /> Get Pro
            </Button>
          </div>
        </div>

        {/* FAQ strip */}
        <div className="mt-8 text-center">
          <p className="text-[#667781] text-sm">
            Questions?{" "}
            <a href="mailto:support@wapp.ai" className="text-primary hover:underline font-medium">
              Contact our team
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
