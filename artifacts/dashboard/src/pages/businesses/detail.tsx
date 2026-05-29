import { useState, useEffect, useRef } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetBusinessQueryKey,
  useGetBusiness,
  getGetBusinessStatsQueryKey,
  useGetBusinessStats,
  useToggleBusiness,
  useUpdateBusiness,
  getListBusinessesQueryKey,
  useListBusinessConversations,
  getListBusinessConversationsQueryKey,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import {
  ArrowLeft,
  MessageCircle,
  Power,
  PowerOff,
  Copy,
  ExternalLink,
  Users,
  MessageSquare,
  Smartphone,
  Wifi,
  WifiOff,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Link2,
  Settings2,
  BarChart3,
  Pencil,
  Save,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KnowledgeTab } from "./knowledge-tab";
import { ContactsTab } from "./contacts-tab";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// ─── QR Connection Panel ──────────────────────────────────────────────────────

type StreamEvent =
  | { type: "connected_to_stream" }
  | { type: "qr"; qrDataUrl: string }
  | { type: "connected"; phone: string }
  | { type: "reconnecting" }
  | { type: "disconnected"; reason?: string };

function QRConnectionPanel({ businessId, onConnected }: { businessId: number; onConnected: () => void }) {
  const [phase, setPhase] = useState<"idle" | "starting" | "qr" | "connected" | "error">("idle");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { toast } = useToast();

  const openStream = (bId: number) => {
    eventSourceRef.current?.close();
    const es = new EventSource(`/api/sessions/${bId}/qr-stream`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const data: StreamEvent = JSON.parse(e.data);
        if (data.type === "qr") {
          setPhase("qr");
          setQrDataUrl(data.qrDataUrl);
        } else if (data.type === "connected") {
          setPhase("connected");
          setConnectedPhone(data.phone);
          es.close();
          toast({ title: "WhatsApp connected!", description: `+${data.phone} is now live.` });
          onConnected();
        } else if (data.type === "reconnecting") {
          // Session is retrying — stay in starting phase, keep stream open for next QR
          setPhase("starting");
          setQrDataUrl(null);
        } else if (data.type === "disconnected") {
          // Only close on explicit logout; otherwise keep stream alive
          if (data.reason === "logged_out") {
            setPhase("idle");
            setQrDataUrl(null);
            es.close();
          } else {
            setPhase("starting");
            setQrDataUrl(null);
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // EventSource will auto-reconnect; nothing to do here
    };
  };

  const startSession = async () => {
    setPhase("starting");
    setQrDataUrl(null);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/sessions/${businessId}/start`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to start session");
      openStream(businessId);
    } catch {
      setPhase("error");
      setErrorMsg("Could not start session. Check server logs.");
    }
  };

  const disconnect = async () => {
    eventSourceRef.current?.close();
    await fetch(`/api/sessions/${businessId}/disconnect`, { method: "POST" });
    setPhase("idle");
    setQrDataUrl(null);
    setConnectedPhone(null);
    onConnected();
  };

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  if (phase === "connected" || connectedPhone) {
    return (
      <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <Wifi className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="font-semibold text-green-900">WhatsApp Connected</p>
            <p className="text-sm text-green-700 font-mono">+{connectedPhone}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={disconnect}>
          <WifiOff className="w-4 h-4 mr-1.5" /> Disconnect
        </Button>
      </div>
    );
  }

  if (phase === "qr" && qrDataUrl) {
    return (
      <div className="flex flex-col items-center gap-6 py-6">
        <div>
          <p className="text-center font-semibold text-foreground mb-1">Scan with WhatsApp</p>
          <p className="text-center text-sm text-muted-foreground">
            Open WhatsApp on your phone → tap the three-dot menu → Linked Devices → Link a Device
          </p>
        </div>
        <div className="relative">
          <img
            src={qrDataUrl}
            alt="WhatsApp QR code"
            className="w-56 h-56 rounded-xl border-4 border-primary/20 shadow-lg"
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow">
              <MessageCircle className="w-7 h-7 text-green-600" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin" />
          Waiting for scan...
        </div>
        <Button variant="ghost" size="sm" onClick={startSession} className="text-muted-foreground">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh QR
        </Button>
      </div>
    );
  }

  if (phase === "starting") {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Generating QR code...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 py-6">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Smartphone className="w-8 h-8 text-primary" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-foreground">Connect via QR scan</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Just like WhatsApp Web — scan the QR code with your phone and the AI bot goes live instantly. No developer account needed.
        </p>
      </div>
      {phase === "error" && (
        <p className="text-sm text-red-600">{errorMsg}</p>
      )}
      <Button onClick={startSession} className="gap-2" data-testid="button-generate-qr">
        <MessageCircle className="w-4 h-4" />
        Generate QR Code
      </Button>
    </div>
  );
}

// ─── Meta Cloud API Panel ─────────────────────────────────────────────────────

function MetaConnectionPanel({ business, onSaved }: { business: { id: number; whatsappPhoneNumber?: string | null; whatsappPhoneNumberId?: string | null; whatsappAccessToken?: string | null; webhookVerifyToken?: string | null; connectionType: string }; onSaved: () => void }) {
  const [formData, setFormData] = useState({
    whatsappPhoneNumber: business.whatsappPhoneNumber ?? "",
    whatsappPhoneNumberId: business.whatsappPhoneNumberId ?? "",
    whatsappAccessToken: business.whatsappAccessToken ?? "",
    webhookVerifyToken: business.webhookVerifyToken ?? crypto.randomUUID().replace(/-/g, "").substring(0, 20),
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard.` });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/businesses/${business.id}/connect-meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Save failed");
      }
      toast({ title: "Meta credentials saved", description: "Webhook is ready." });
      onSaved();
    } catch (err: unknown) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const webhookUrl = `${window.location.origin}/api/whatsapp/webhook`;

  return (
    <div className="space-y-4">
      <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Webhook Config (paste into Meta)</p>
        <div className="space-y-2">
          <div>
            <p className="text-xs font-medium mb-1">Webhook URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-background border rounded px-2 py-1.5 font-mono truncate">{webhookUrl}</code>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(webhookUrl, "Webhook URL")}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-1">Verify Token</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-background border rounded px-2 py-1.5 font-mono truncate">{formData.webhookVerifyToken}</code>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(formData.webhookVerifyToken, "Verify Token")}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1">Phone Number</label>
            <input className="w-full text-sm border rounded px-3 py-2 bg-background" placeholder="+91 98765..." value={formData.whatsappPhoneNumber} onChange={e => setFormData(p => ({ ...p, whatsappPhoneNumber: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Phone Number ID</label>
            <input className="w-full text-sm border rounded px-3 py-2 bg-background font-mono" placeholder="1234567890..." value={formData.whatsappPhoneNumberId} onChange={e => setFormData(p => ({ ...p, whatsappPhoneNumberId: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">System User Access Token</label>
          <input type="password" className="w-full text-sm border rounded px-3 py-2 bg-background font-mono" placeholder="EAAB..." value={formData.whatsappAccessToken} onChange={e => setFormData(p => ({ ...p, whatsappAccessToken: e.target.value }))} />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Credentials"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BusinessDetail() {
  const [, params] = useRoute("/businesses/:id");
  const businessId = parseInt(params?.id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: business, isLoading: businessLoading } = useGetBusiness(businessId, {
    query: { enabled: !!businessId, queryKey: getGetBusinessQueryKey(businessId) },
  });

  const { data: stats } = useGetBusinessStats(businessId, {
    query: { enabled: !!businessId, queryKey: getGetBusinessStatsQueryKey(businessId) },
  });

  const { data: conversations, isLoading: convsLoading } = useListBusinessConversations(businessId, {
    query: { enabled: !!businessId, queryKey: getListBusinessConversationsQueryKey(businessId) },
  });

  const toggleBot = useToggleBusiness();
  const updateBusiness = useUpdateBusiness();

  const [editingAI, setEditingAI] = useState(false);
  const [aiDraft, setAiDraft] = useState({ systemPrompt: "", products: "", faqs: "" });

  const startEditAI = () => {
    setAiDraft({
      systemPrompt: business?.systemPrompt ?? "",
      products: business?.products ?? "",
      faqs: business?.faqs ?? "",
    });
    setEditingAI(true);
  };

  const saveAI = () => {
    updateBusiness.mutate(
      { id: businessId, data: { systemPrompt: aiDraft.systemPrompt, products: aiDraft.products || undefined, faqs: aiDraft.faqs || undefined } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetBusinessQueryKey(businessId), data);
          setEditingAI(false);
          toast({ title: "AI config saved", description: "The bot will use these rules from now on." });
        },
        onError: () => {
          toast({ title: "Save failed", description: "Could not save AI config.", variant: "destructive" });
        },
      }
    );
  };

  const handleToggle = () => {
    toggleBot.mutate({ id: businessId }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetBusinessQueryKey(businessId), data);
        queryClient.invalidateQueries({ queryKey: getListBusinessesQueryKey() });
        toast({
          title: data.isActive ? "Bot Activated" : "Bot Paused",
          description: data.isActive ? "AI bot will respond to messages." : "Bot is paused.",
        });
      },
    });
  };

  const refreshBusiness = () => {
    queryClient.invalidateQueries({ queryKey: getGetBusinessQueryKey(businessId) });
    queryClient.invalidateQueries({ queryKey: getGetBusinessStatsQueryKey(businessId) });
    queryClient.invalidateQueries({ queryKey: getListBusinessConversationsQueryKey(businessId) });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard.` });
  };

  const isConnected =
    (business?.connectionType === "qr_session" && business?.sessionStatus === "connected") ||
    (business?.connectionType === "meta_cloud" && !!business?.whatsappPhoneNumberId);

  if (businessLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-muted-foreground">Business not found.</p>
        <Button variant="outline" onClick={() => setLocation("/")}>Back to Dashboard</Button>
      </div>
    );
  }

  const displayPhone = business.connectedPhone
    ? `+${business.connectedPhone}`
    : business.whatsappPhoneNumber ?? null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="icon" className="shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{business.name}</h1>
              <Badge variant={business.isActive ? "default" : "secondary"}>
                {business.isActive ? "Active" : "Paused"}
              </Badge>
              {isConnected ? (
                <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50 gap-1">
                  <Wifi className="w-3 h-3" /> Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50 gap-1">
                  <WifiOff className="w-3 h-3" /> Not Connected
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              {displayPhone ?? business.businessType}
            </p>
          </div>
        </div>
        <Button
          variant={business.isActive ? "destructive" : "default"}
          onClick={handleToggle}
          disabled={toggleBot.isPending}
          size="sm"
        >
          {business.isActive ? (
            <><PowerOff className="w-4 h-4 mr-2" /> Pause Bot</>
          ) : (
            <><Power className="w-4 h-4 mr-2" /> Activate Bot</>
          )}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[
          { label: "Total Messages", value: stats?.totalMessages ?? 0 },
          { label: "Conversations", value: stats?.totalConversations ?? 0 },
          { label: "Active Customers", value: stats?.activeCustomers ?? 0 },
          { label: "This Week", value: stats?.messagesThisWeek ?? 0, highlight: true },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-medium">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold font-mono", s.highlight && "text-primary")}>
                {s.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main tabs */}
      <Tabs defaultValue={isConnected ? "conversations" : "connect"} className="w-full">
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="connect" className="gap-1.5">
            <Link2 className="w-3.5 h-3.5" /> Connect
          </TabsTrigger>
          <TabsTrigger value="conversations" className="gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> Chats
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" /> Knowledge
          </TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1.5">
            <Users className="w-3.5 h-3.5" /> Contacts
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings2 className="w-3.5 h-3.5" /> Settings
          </TabsTrigger>
        </TabsList>

        {/* ── Connect Tab ── */}
        <TabsContent value="connect" className="pt-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* QR Card */}
            <Card className={cn("border-2", (!business.connectionType || business.connectionType === "pending" || business.connectionType === "qr_session") && "border-primary/30")}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-primary" />
                    Scan QR Code
                  </CardTitle>
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/5">Recommended</Badge>
                </div>
                <CardDescription className="text-xs">
                  Works like WhatsApp Web. No developer account needed. Scan once, runs 24/7.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {business.connectionType === "qr_session" && business.sessionStatus === "connected" ? (
                  <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-900">Connected</p>
                      <p className="text-xs text-green-700 font-mono">+{business.connectedPhone}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="ml-auto text-red-600" onClick={async () => {
                      await fetch(`/api/sessions/${businessId}/disconnect`, { method: "POST" });
                      refreshBusiness();
                    }}>
                      <WifiOff className="w-3.5 h-3.5 mr-1" /> Disconnect
                    </Button>
                  </div>
                ) : (
                  <QRConnectionPanel businessId={businessId} onConnected={refreshBusiness} />
                )}
              </CardContent>
            </Card>

            {/* Meta Cloud API Card */}
            <Card className={cn("border-2", business.connectionType === "meta_cloud" && "border-blue-200")}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-blue-600" />
                    Meta Cloud API
                  </CardTitle>
                  {business.connectionType === "meta_cloud" && (
                    <Badge variant="outline" className="text-xs border-blue-200 text-blue-700">Active</Badge>
                  )}
                </div>
                <CardDescription className="text-xs">
                  Official Meta integration. Requires a Meta developer account and WhatsApp Business API access.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MetaConnectionPanel
                  business={business}
                  onSaved={refreshBusiness}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Conversations Tab ── */}
        <TabsContent value="conversations" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conversations</CardTitle>
              <CardDescription>All chat threads managed by the AI agent.</CardDescription>
            </CardHeader>
            <CardContent>
              {convsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : !conversations || conversations.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <MessageSquare className="w-8 h-8 text-muted-foreground/50" />
                  <p className="font-medium text-muted-foreground">No conversations yet</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    {isConnected
                      ? "When customers message your WhatsApp number, conversations will appear here."
                      : "Connect your WhatsApp number first to start receiving messages."}
                  </p>
                  {!isConnected && (
                    <Link href={`/businesses/${businessId}`}>
                      <Button size="sm" variant="outline">Connect WhatsApp</Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {conversations.map((conv) => (
                    <Link key={conv.id} href={`/conversations/${businessId}/${conv.id}`}>
                      <div className="py-3.5 flex items-center justify-between hover:bg-muted/40 -mx-6 px-6 cursor-pointer transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4 text-secondary-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{conv.customerName || conv.customerPhone}</p>
                            <p className="text-xs text-muted-foreground font-mono">{conv.customerPhone}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-right">
                          <div className="hidden sm:block">
                            <p className="text-xs font-medium">{conv.messageCount} messages</p>
                            <p className="text-xs text-muted-foreground">
                              {conv.lastMessageAt ? format(new Date(conv.lastMessageAt), "MMM d, h:mm a") : "New"}
                            </p>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Knowledge Tab ── */}
        <TabsContent value="knowledge" className="pt-4">
          <KnowledgeTab businessId={businessId} />
        </TabsContent>

        {/* ── Contacts Tab ── */}
        <TabsContent value="contacts" className="pt-4">
          <ContactsTab businessId={businessId} />
        </TabsContent>

        {/* ── Settings Tab ── */}
        <TabsContent value="settings" className="pt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
              <div>
                <CardTitle className="text-base">AI Configuration</CardTitle>
                <CardDescription className="mt-1">
                  These rules shape how the bot responds to every incoming message.
                </CardDescription>
              </div>
              {!editingAI && (
                <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={startEditAI}>
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-5">
              {editingAI ? (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      System Prompt <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Core instructions for the AI — tone, goal, what to do / not do.
                    </p>
                    <Textarea
                      rows={8}
                      className="font-mono text-xs resize-y"
                      value={aiDraft.systemPrompt}
                      onChange={(e) => setAiDraft((d) => ({ ...d, systemPrompt: e.target.value }))}
                      placeholder="You are a helpful sales assistant for…"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Products / Services
                    </label>
                    <p className="text-xs text-muted-foreground">
                      List your offerings so the AI can recommend and describe them accurately.
                    </p>
                    <Textarea
                      rows={5}
                      className="text-sm resize-y"
                      value={aiDraft.products}
                      onChange={(e) => setAiDraft((d) => ({ ...d, products: e.target.value }))}
                      placeholder={"- Classic Burger — $8.99, beef patty with lettuce, tomato\n- Veggie Wrap — $7.50, grilled veggies…"}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      FAQs
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Common questions and answers the AI should know by heart.
                    </p>
                    <Textarea
                      rows={5}
                      className="text-sm resize-y"
                      value={aiDraft.faqs}
                      onChange={(e) => setAiDraft((d) => ({ ...d, faqs: e.target.value }))}
                      placeholder={"Q: What are your opening hours?\nA: We're open Mon–Fri 9am–6pm.\n\nQ: Do you deliver?\nA: Yes, within 10 km."}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="gap-1.5" onClick={saveAI} disabled={updateBusiness.isPending || !aiDraft.systemPrompt.trim()}>
                      {updateBusiness.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save changes
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setEditingAI(false)} disabled={updateBusiness.isPending}>
                      <X className="w-3.5 h-3.5" /> Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">System Prompt</p>
                    <div className="bg-muted/50 p-3 rounded-md text-xs font-mono text-muted-foreground whitespace-pre-wrap border">
                      {business.systemPrompt}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Products / Services</p>
                    {business.products ? (
                      <div className="bg-muted/50 p-3 rounded-md text-sm whitespace-pre-wrap border">{business.products}</div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Not set — click Edit to add your product catalog.</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">FAQs</p>
                    {business.faqs ? (
                      <div className="bg-muted/50 p-3 rounded-md text-sm whitespace-pre-wrap border">{business.faqs}</div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Not set — click Edit to add common Q&amp;As.</p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
