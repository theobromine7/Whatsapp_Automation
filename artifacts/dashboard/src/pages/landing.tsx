import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  MessageCircle, Zap, ShoppingBag, QrCode,
  Bot, ArrowRight, Check, Store,
} from "lucide-react";

const FEATURES = [
  {
    icon: Bot,
    title: "AI-Powered Responses",
    desc: "Gemini AI answers customer queries 24/7 — in their language, instantly.",
  },
  {
    icon: ShoppingBag,
    title: "Product Catalog Sync",
    desc: "Pull your Advize store products into the bot so it always knows what you sell.",
  },
  {
    icon: QrCode,
    title: "UPI Payment QR",
    desc: "Customer says 'I want to buy' — the bot auto-sends a payment QR. Done.",
  },
  {
    icon: MessageCircle,
    title: "Full Conversation History",
    desc: "Every WhatsApp thread is saved. Review chats and tune your bot anytime.",
  },
];

const BULLETS = [
  "No coding required",
  "Works with any WhatsApp number",
  "Connects to your Advize store in one click",
  "Live in under 5 minutes",
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">NexusAgent</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="gap-1.5">
                Get started <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <Zap className="w-3.5 h-3.5" />
          Powered by Gemini AI
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight max-w-3xl leading-tight">
          Turn WhatsApp into your{" "}
          <span className="text-primary">24/7 AI Sales Agent</span>
        </h1>
        <p className="mt-5 text-muted-foreground text-lg max-w-xl">
          Register your WhatsApp number, connect your Advize store, and let an AI bot handle customer queries, share product links, and collect UPI payments — automatically.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/signup">
            <Button size="lg" className="gap-2 px-8">
              <Store className="w-4 h-4" />
              Start for free
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="gap-2 px-8">
              Already on Advize? Sign in
            </Button>
          </Link>
        </div>

        {/* Bullet trust signals */}
        <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2">
          {BULLETS.map((b) => (
            <li key={b} className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
              {b}
            </li>
          ))}
        </ul>
      </section>

      {/* Features */}
      <section className="bg-muted/40 border-t py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Everything your sales bot needs</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-background rounded-xl border p-5 flex flex-col gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-sm">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-16 px-6 text-center border-t">
        <h2 className="text-2xl font-bold mb-3">Ready to automate your sales?</h2>
        <p className="text-muted-foreground mb-6">Join businesses already using NexusAgent on WhatsApp.</p>
        <Link href="/signup">
          <Button size="lg" className="gap-2 px-10">
            Get started free <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </section>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} NexusAgent · Built on Advize
      </footer>
    </div>
  );
}
