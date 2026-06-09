import { useLocation } from "wouter";
import { Check, X, Zap, Crown, Gift, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type PlanId = "free" | "starter" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  priceNote?: string;
  badge?: string;
  highlight?: boolean;
  description: string;
  icon: React.ElementType;
  accentColor: string;
  accentBg: string;
  cta: string;
  features: { label: string; value: string | false; included: boolean }[];
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description: "Try the full platform. No credit card needed.",
    icon: Gift,
    accentColor: "text-emerald-600",
    accentBg: "bg-emerald-500",
    cta: "Start for Free",
    features: [
      { label: "AI replies", value: "30 / month", included: true },
      { label: "Outgoing messages", value: "5 / day", included: true },
      { label: "New contacts", value: "3 / day", included: true },
      { label: "WhatsApp QR connection", value: "Included", included: true },
      { label: "Daily broadcasts", value: false, included: false },
      { label: "Follow-ups", value: false, included: false },
      { label: "Official Meta Cloud API", value: false, included: false },
      { label: "Priority support", value: false, included: false },
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: 1,
    badge: "QR Only",
    description: "QR-based connection, no Meta account required. Great for small businesses.",
    icon: Zap,
    accentColor: "text-blue-600",
    accentBg: "bg-blue-500",
    cta: "Get Starter",
    features: [
      { label: "AI replies", value: "Unlimited", included: true },
      { label: "Outgoing messages", value: "50 / day", included: true },
      { label: "New contacts", value: "10 / day", included: true },
      { label: "WhatsApp QR connection", value: "Included", included: true },
      { label: "Daily broadcasts", value: "20 / day", included: true },
      { label: "Follow-ups", value: "Enabled", included: true },
      { label: "Official Meta Cloud API", value: false, included: false },
      { label: "Priority support", value: false, included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 999,
    priceNote: "+ WhatsApp message fees (pay-as-you-go)",
    badge: "Most Popular",
    highlight: true,
    description: "Official Meta Cloud API. Unlimited everything. Enterprise reliability.",
    icon: Crown,
    accentColor: "text-[#00a884]",
    accentBg: "bg-[#00a884]",
    cta: "Get Pro",
    features: [
      { label: "AI replies", value: "Unlimited", included: true },
      { label: "Outgoing messages", value: "Unlimited", included: true },
      { label: "New contacts", value: "Unlimited", included: true },
      { label: "WhatsApp QR connection", value: "Included", included: true },
      { label: "Daily broadcasts", value: "Unlimited", included: true },
      { label: "Follow-ups", value: "Enabled", included: true },
      { label: "Official Meta Cloud API", value: "Included", included: true },
      { label: "Priority support", value: "Included", included: true },
    ],
  },
];

const COMPARISON_ROWS: {
  label: string;
  values: [string, string, string];
}[] = [
  { label: "Monthly price",         values: ["Free",    "₹399",     "₹999"]     },
  { label: "AI replies",            values: ["30 / mo", "Unlimited","Unlimited"] },
  { label: "Outgoing msgs / day",   values: ["5",       "50",       "Unlimited"] },
  { label: "Broadcasts / day",      values: ["—",       "20",       "Unlimited"] },
  { label: "New contacts / day",    values: ["3",       "10",       "Unlimited"] },
  { label: "Follow-ups",            values: ["—",       "✓",        "✓"]        },
  { label: "WhatsApp QR",           values: ["✓",       "✓",        "✓"]        },
  { label: "Meta Cloud API",        values: ["—",       "—",        "✓"]        },
  { label: "Priority support",      values: ["—",       "—",        "✓"]        },
];

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({ plan, onSelect }: { plan: Plan; onSelect: (id: PlanId) => void }) {
  const Icon = plan.icon;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border-2 bg-white p-6 transition-all duration-200",
        plan.highlight
          ? "border-[#00a884] shadow-lg shadow-[#00a884]/10 scale-[1.02]"
          : "border-[#e9edef] hover:border-[#d1d7db] hover:shadow-md"
      )}
    >
      {plan.badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
          <span className={cn(
            "text-xs font-semibold px-3 py-1 rounded-full border",
            plan.highlight
              ? "bg-[#00a884] text-white border-[#00a884]"
              : "bg-blue-50 text-blue-700 border-blue-200"
          )}>
            {plan.badge}
          </span>
        </div>
      )}

      {/* Icon + Name */}
      <div className="flex items-center gap-3 mb-5">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", plan.accentBg)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-lg text-[#111b21]">{plan.name}</span>
      </div>

      {/* Price */}
      <div className="mb-1">
        {plan.price === 0 ? (
          <span className="text-4xl font-bold text-[#111b21]">Free</span>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-[#111b21]">₹{plan.price}</span>
            <span className="text-sm text-[#667781]">/month</span>
          </div>
        )}
        {plan.priceNote && (
          <p className="text-[11px] text-[#8696a0] mt-1 leading-relaxed">{plan.priceNote}</p>
        )}
      </div>

      <p className="text-sm text-[#667781] mb-5 leading-relaxed">{plan.description}</p>

      {/* CTA */}
      <Button
        className={cn(
          "w-full gap-2 mb-6",
          plan.highlight && "bg-[#00a884] hover:bg-[#008f71] border-[#00a884] text-white"
        )}
        variant={plan.id === "free" ? "outline" : "default"}
        onClick={() => onSelect(plan.id)}
      >
        {plan.cta} <ArrowRight className="w-3.5 h-3.5" />
      </Button>

      {/* Features */}
      <ul className="space-y-2.5 flex-1">
        {plan.features.map((f) => (
          <li key={f.label} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {f.included ? (
                <Check className={cn("w-3.5 h-3.5 shrink-0", plan.accentColor)} />
              ) : (
                <X className="w-3.5 h-3.5 shrink-0 text-[#c4c4c4]" />
              )}
              <span className={cn(
                "text-xs truncate",
                f.included ? "text-[#111b21]" : "text-[#aab4bb]"
              )}>
                {f.label}
              </span>
            </div>
            <span className={cn(
              "text-xs shrink-0",
              f.included ? "text-[#667781] font-medium" : "text-[#c4c4c4]"
            )}>
              {f.included && f.value ? f.value : f.included ? "" : "—"}
            </span>
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

  const planIds: PlanId[] = ["free", "starter", "pro"];

  return (
    <div className="flex-1 overflow-y-auto bg-[#f0f2f5]">
      {/* Header bar */}
      <div className="h-[60px] bg-[#f0f2f5] border-b border-[#e9edef] px-4 md:px-6 flex items-center shrink-0">
        <h1 className="font-semibold text-[#111b21] text-base">Pricing</h1>
      </div>

      <div className="px-4 py-8 max-w-5xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-medium mb-3">
            <Sparkles className="w-3 h-3" /> Simple, transparent pricing
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-[#111b21] mb-2">
            Pick the plan that fits your business.
          </h2>
          <p className="text-[#667781] text-sm md:text-base">
            Upgrade or cancel anytime. No lock-in.
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10 items-start">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onSelect={handleSelect} />
          ))}
        </div>

        {/* Full Comparison Table */}
        <div className="bg-white rounded-2xl border border-[#e9edef] overflow-hidden">
          {/* Table header */}
          <div className="px-6 py-4 border-b border-[#e9edef]">
            <h3 className="font-semibold text-[#111b21] text-base">Full Comparison</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-[#e9edef] bg-[#f8f9fa]">
                  <th className="text-left px-6 py-3.5 text-[#667781] font-medium w-[45%]">Feature</th>
                  {PLANS.map((plan) => (
                    <th
                      key={plan.id}
                      className={cn(
                        "text-center px-4 py-3.5 font-semibold",
                        plan.highlight ? "text-[#00a884]" : "text-[#667781]"
                      )}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span>{plan.name}</span>
                        {plan.badge && (
                          <span className={cn(
                            "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                            plan.highlight
                              ? "bg-[#00a884]/10 text-[#00a884] border-[#00a884]/20"
                              : "bg-blue-50 text-blue-600 border-blue-200"
                          )}>
                            {plan.badge}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr
                    key={row.label}
                    className={cn(
                      "border-b border-[#f0f2f5] transition-colors hover:bg-[#f8f9fa]",
                      i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"
                    )}
                  >
                    <td className="px-6 py-3.5 text-[#111b21] font-medium text-sm">{row.label}</td>
                    {row.values.map((val, vi) => (
                      <td
                        key={vi}
                        className={cn(
                          "px-4 py-3.5 text-center text-sm",
                          PLANS[vi]?.highlight ? "text-[#00a884] font-semibold" : "text-[#667781]",
                          val === "—" && "text-[#c4c4c4]",
                          val === "✓" && (PLANS[vi]?.highlight ? "text-[#00a884]" : "text-emerald-500")
                        )}
                      >
                        {val === "✓" ? (
                          <span className="inline-flex justify-center">
                            <Check className={cn(
                              "w-4 h-4",
                              PLANS[vi]?.highlight ? "text-[#00a884]" : "text-emerald-500"
                            )} />
                          </span>
                        ) : val === "—" ? (
                          <span className="text-[#d1d7db]">—</span>
                        ) : val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>

              {/* CTA row — button for each plan */}
              <tfoot>
                <tr className="bg-[#f8f9fa] border-t-2 border-[#e9edef]">
                  <td className="px-6 py-5">
                    <p className="text-xs text-[#8696a0]">
                      All plans include inbox, conversation history &amp; AI bot.
                    </p>
                  </td>
                  {planIds.map((planId) => {
                    const plan = PLANS.find((p) => p.id === planId)!;
                    return (
                      <td key={planId} className="px-4 py-5 text-center">
                        <Button
                          size="sm"
                          className={cn(
                            "w-full gap-1.5 text-xs",
                            plan.highlight && "bg-[#00a884] hover:bg-[#008f71] text-white border-[#00a884]"
                          )}
                          variant={planId === "free" ? "outline" : "default"}
                          onClick={() => handleSelect(planId)}
                        >
                          {plan.cta}
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-8 text-center">
          <p className="text-[#8696a0] text-sm">
            Need a custom plan for your team?{" "}
            <a href="mailto:support@wapp.ai" className="text-primary hover:underline font-medium">
              Contact us
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
