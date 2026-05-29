import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Clock,
  ExternalLink,
  Zap,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const BSP_OPTIONS = [
  {
    name: "360Dialog",
    description: "Most popular WhatsApp BSP. Simple onboarding, connects directly to your existing WhatsApp Business number.",
    setupTime: "Same day",
    pricing: "From $5/month",
    signupUrl: "https://www.360dialog.com/",
    credentialsFrom: "360Dialog dashboard → Manage → API Keys",
    recommended: true,
  },
  {
    name: "Twilio",
    description: "Reliable, developer-friendly. Works with any WhatsApp Business number. Sandbox available for testing.",
    setupTime: "Same day",
    pricing: "Pay per message",
    signupUrl: "https://www.twilio.com/en-us/whatsapp",
    credentialsFrom: "Twilio Console → Messaging → Senders → WhatsApp",
    recommended: false,
  },
  {
    name: "WATI",
    description: "Built specifically for small businesses. Includes a shared inbox, no technical setup required.",
    setupTime: "Same day",
    pricing: "From $49/month",
    signupUrl: "https://www.wati.io/",
    credentialsFrom: "WATI Settings → API → Access Token",
    recommended: false,
  },
];

const META_STEPS = [
  {
    step: 1,
    title: "Create a Facebook Business Manager",
    detail: "Go to business.facebook.com and create a free business account. If you already run Facebook or Instagram ads, you already have this.",
    url: "https://business.facebook.com/",
    urlLabel: "Open Business Manager",
  },
  {
    step: 2,
    title: "Apply for WhatsApp Business API access",
    detail: "Inside Business Manager, go to WhatsApp Accounts → Add → Connect a WhatsApp number. Meta will verify your business (usually 24–48 hours).",
    url: "https://business.facebook.com/wa/manage/home/",
    urlLabel: "Open WhatsApp Manager",
  },
  {
    step: 3,
    title: "Create a Meta Developer App",
    detail: "Go to developers.facebook.com, create an app, add the WhatsApp product, and grab your Phone Number ID and access token.",
    url: "https://developers.facebook.com/apps/",
    urlLabel: "Open Developer Console",
  },
  {
    step: 4,
    title: "Come back here to register",
    detail: "Once you have your credentials, return to NexusAgent and register your business.",
    url: null,
    urlLabel: null,
  },
];

export default function ConnectWhatsApp() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="outline" size="icon" className="shrink-0" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Connect a WhatsApp Number</h1>
          <p className="text-muted-foreground text-sm">
            Choose the path that fits your situation.
          </p>
        </div>
      </div>

      {/* Already have credentials */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-center justify-between gap-4 pt-5 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Already have WhatsApp API credentials?</p>
              <p className="text-sm text-muted-foreground">
                You have a Phone Number ID and Access Token ready — go straight to registration.
              </p>
            </div>
          </div>
          <Link href="/businesses/new">
            <Button className="shrink-0" data-testid="button-already-have-credentials">
              Register Now <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-sm text-muted-foreground font-medium">Don't have credentials yet? Pick a path.</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Path A — BSP */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold">Path A — Use a WhatsApp Partner (easier, same day)</h2>
          </div>
          <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">Recommended for most businesses</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          WhatsApp Business Solution Providers (BSPs) have already done the Meta verification. You sign up on their platform, connect your number through their simple onboarding, and they give you API credentials. No Meta developer account needed.
        </p>

        <div className="grid gap-3">
          {BSP_OPTIONS.map((bsp) => (
            <Card key={bsp.name} className={cn("relative", bsp.recommended && "border-primary/40")}>
              {bsp.recommended && (
                <div className="absolute -top-2.5 left-4">
                  <Badge className="text-xs bg-primary text-primary-foreground">Most popular</Badge>
                </div>
              )}
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">{bsp.name}</p>
                      <span className="text-xs text-muted-foreground font-mono">{bsp.pricing}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{bsp.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {bsp.setupTime}
                      </div>
                      <div className="flex items-center gap-1 text-foreground/60">
                        Credentials from: <span className="font-mono">{bsp.credentialsFrom}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <a href={bsp.signupUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant={bsp.recommended ? "default" : "outline"} className="gap-1.5 w-full" data-testid={`button-bsp-${bsp.name.toLowerCase()}`}>
                        Sign up <ExternalLink className="w-3 h-3" />
                      </Button>
                    </a>
                    <Link href="/businesses/new">
                      <Button size="sm" variant="ghost" className="text-xs text-muted-foreground w-full">
                        I have credentials
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Path B — Meta directly */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold">Path B — Go directly through Meta (free, takes 1–3 days)</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          If you already have a Facebook Business Manager account (common if you run FB/Instagram ads), you can apply for WhatsApp Business API access directly. It's free but takes a day or two for Meta to verify your business.
        </p>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Step-by-step setup</CardTitle>
            <CardDescription className="text-xs">Follow these steps in order. Once done, come back to register your business.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {META_STEPS.map((s, i) => (
              <div key={s.step} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {s.step}
                  </div>
                  {i < META_STEPS.length - 1 && (
                    <div className="w-px flex-1 bg-border mt-2" />
                  )}
                </div>
                <div className="pb-4 flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground">{s.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{s.detail}</p>
                  {s.url && (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary text-xs mt-1.5 hover:underline"
                    >
                      {s.urlLabel} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {!s.url && (
                    <Link href="/businesses/new">
                      <span className="inline-flex items-center gap-1 text-primary text-xs mt-1.5 hover:underline cursor-pointer">
                        <CheckCircle className="w-3 h-3" /> Register your business
                      </span>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Bottom CTA */}
      <div className="flex justify-center pb-4">
        <Link href="/businesses/new">
          <Button variant="outline" data-testid="button-bottom-register">
            I have my credentials — Register Now <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
