import { useState, useEffect, useRef } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { auth } from "@/lib/firebase";
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
  customFetch,
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
  Store,
  Clock,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KnowledgeTab } from "./knowledge-tab";
import { ContactsTab } from "./contacts-tab";
import { FirebaseSyncTab } from "./firebase-sync-tab";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ─── QR Connection Panel ──────────────────────────────────────────────────────

type StreamEvent =
  | { type: "connected_to_stream" }
  | { type: "qr"; qrDataUrl: string }
  | { type: "connected"; phone: string }
  | { type: "reconnecting" }
  | { type: "disconnected"; reason?: string }
  | { type: "pairing_code"; code: string }
  | { type: "pairing_error"; message: string };

function QRConnectionPanel({ businessId, onConnected }: { businessId: number; onConnected: () => void }) {
  const [phase, setPhase] = useState<"idle" | "starting" | "qr" | "connected" | "error" | "pairing_input" | "pairing_wait" | "pairing_code">("idle");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState("91");
  const [phoneInput, setPhoneInput] = useState("");
  const eventSourceRef = useRef<EventSource | null>(null);
  const { toast } = useToast();

  const openStream = async (bId: number) => {
    eventSourceRef.current?.close();
    // EventSource cannot send custom headers — pass the Firebase token as a query param instead
    let tokenParam = "";
    try {
      const token = await auth?.currentUser?.getIdToken();
      if (token) tokenParam = `?token=${encodeURIComponent(token)}`;
    } catch { /* proceed without token (dev bypass will handle it) */ }
    const es = new EventSource(`/api/sessions/${bId}/qr-stream${tokenParam}`);
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
        } else if (data.type === "pairing_code") {
          setPairingCode(data.code);
          setPhase("pairing_code");
        } else if (data.type === "pairing_error") {
          setPhase("pairing_input");
          setErrorMsg(data.message);
        } else if (data.type === "reconnecting") {
          // Session is retrying — stay in starting phase, keep stream open for next QR
          setPhase("starting");
          setQrDataUrl(null);
        } else if (data.type === "disconnected") {
          // "logged_out" = removed from phone; "manual" = clicked Disconnect; others = retry
          if (data.reason === "logged_out" || data.reason === "manual") {
            setPhase("idle");
            setQrDataUrl(null);
            setConnectedPhone(null);
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
      const res = await customFetch(`/api/sessions/${businessId}/start`, { method: "POST" });
      if (!res) throw new Error("Failed to start session");
      openStream(businessId);
    } catch {
      setPhase("error");
      setErrorMsg("Could not start session. Check server logs.");
    }
  };

  const disconnect = async () => {
    eventSourceRef.current?.close();
    try {
      await customFetch(`/api/sessions/${businessId}/disconnect`, { method: "POST" });
    } catch {
      // Even if the API call fails, reset the UI — the SSE stream is already closed
    }
    setPhase("idle");
    setQrDataUrl(null);
    setConnectedPhone(null);
    onConnected();
  };

  const startPairingSession = async () => {
    const cc = countryCode.replace(/\D/g, "");
    const num = phoneInput.replace(/\D/g, "");
    if (!cc) {
      setErrorMsg("Enter a country code (e.g. 91 for India)");
      return;
    }
    if (num.length < 6) {
      setErrorMsg("Enter a valid phone number");
      return;
    }
    const digits = cc + num;
    setPhase("pairing_wait");
    setPairingCode(null);
    setErrorMsg(null);
    try {
      await customFetch(`/api/sessions/${businessId}/pairing-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits }),
      });
      openStream(businessId);
    } catch {
      setPhase("pairing_input");
      setErrorMsg("Could not start session. Check server logs.");
    }
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

  if (phase === "pairing_wait") {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Generating your pairing code...</p>
        <p className="text-xs text-muted-foreground">This takes about 5 seconds</p>
      </div>
    );
  }

  if (phase === "pairing_code" && pairingCode) {
    return (
      <div className="flex flex-col items-center gap-6 py-6">
        <div className="text-center">
          <p className="font-semibold text-foreground mb-1">Enter this code in WhatsApp</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Open WhatsApp → Settings → Linked Devices → Link a Device → Link with Phone Number
          </p>
        </div>
        <div className="px-8 py-5 bg-primary/5 border-2 border-primary/20 rounded-2xl text-center">
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Pairing Code</p>
          <p className="text-4xl font-bold font-mono tracking-widest text-primary">{pairingCode}</p>
          <p className="text-xs text-muted-foreground mt-2">Valid for a few minutes</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin" />
          Waiting for you to enter the code...
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setPhase("pairing_input"); setPairingCode(null); }} className="text-muted-foreground">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Try again
        </Button>
      </div>
    );
  }

  if (phase === "pairing_input") {
    return (
      <div className="flex flex-col gap-4 py-4">
        <div>
          <p className="font-semibold text-foreground mb-1">Connect with phone number</p>
          <p className="text-sm text-muted-foreground">
            Enter your WhatsApp number to get an 8-digit pairing code — no QR scan needed.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center border rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0 bg-background shrink-0 w-28">
            <span className="pl-3 text-muted-foreground text-sm select-none">+</span>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="91"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={(e) => e.key === "Enter" && startPairingSession()}
              className="w-full px-1.5 py-2 text-sm font-mono bg-transparent outline-none"
            />
          </div>
          <Input
            type="tel"
            inputMode="numeric"
            placeholder="Phone number"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && startPairingSession()}
            className="font-mono flex-1"
          />
          <Button onClick={startPairingSession} className="shrink-0">Get Code</Button>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          e.g. country code <span className="font-mono">91</span> + number <span className="font-mono">9876543210</span>
        </p>
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        <Button variant="ghost" size="sm" onClick={() => { setPhase("idle"); setErrorMsg(null); }} className="text-muted-foreground self-start -mt-1">
          ← Back to QR scan
        </Button>
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
      <div className="flex items-center gap-3 w-full max-w-xs">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      <Button variant="outline" onClick={() => { setPhase("pairing_input"); setErrorMsg(null); }} className="gap-2 text-sm">
        <Smartphone className="w-4 h-4" />
        Connect with phone number
      </Button>
    </div>
  );
}

// ─── Meta Cloud API Panel ─────────────────────────────────────────────────────

function MetaConnectionPanel({ business, onSaved }: {
  business: {
    id: number;
    whatsappPhoneNumber?: string | null;
    whatsappPhoneNumberId?: string | null;
    whatsappAccessToken?: string | null;
    webhookVerifyToken?: string | null;
    connectionType: string;
  };
  onSaved: () => void;
}) {
  const isConnected = business.connectionType === "meta_cloud" && !!business.whatsappPhoneNumberId;
  const [editing, setEditing] = useState(!isConnected);
  const [formData, setFormData] = useState({
    whatsappPhoneNumber: business.whatsappPhoneNumber ?? "",
    whatsappPhoneNumberId: business.whatsappPhoneNumberId ?? "",
    whatsappAccessToken: business.whatsappAccessToken ?? "",
    webhookVerifyToken: business.webhookVerifyToken ?? crypto.randomUUID().replace(/-/g, "").substring(0, 20),
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  const webhookUrl = `${window.location.origin}/api/whatsapp/webhook`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard.` });
  };

  const testCredentials = async () => {
    if (!formData.whatsappPhoneNumberId || !formData.whatsappAccessToken) {
      toast({ title: "Missing fields", description: "Enter Phone Number ID and Access Token first.", variant: "destructive" });
      return;
    }
    setTesting(true);
    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${formData.whatsappPhoneNumberId}`,
        { headers: { Authorization: `Bearer ${formData.whatsappAccessToken}` } }
      );
      const data = await res.json() as { id?: string; display_phone_number?: string; error?: { message: string } };
      if (res.ok && data.id) {
        toast({
          title: "✅ Credentials valid",
          description: `Phone: ${data.display_phone_number ?? formData.whatsappPhoneNumber}. Ready to save.`,
        });
        if (data.display_phone_number && !formData.whatsappPhoneNumber) {
          setFormData(p => ({ ...p, whatsappPhoneNumber: data.display_phone_number! }));
        }
      } else {
        toast({
          title: "❌ Invalid credentials",
          description: data.error?.message ?? "Meta API rejected the token. Check Phone Number ID and access token.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Network error", description: "Could not reach Meta API to verify.", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    if (!formData.whatsappPhoneNumber || !formData.whatsappPhoneNumberId || !formData.whatsappAccessToken) {
      toast({ title: "All fields required", description: "Fill in all Meta credentials before saving.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await customFetch(`/api/businesses/${business.id}/connect-meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      toast({ title: "✅ Meta API connected", description: "Your WhatsApp Business API is live." });
      setEditing(false);
      onSaved();
    } catch (err: unknown) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Connected State ──
  if (isConnected && !editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-900">Meta Cloud API Connected</p>
            <p className="text-xs text-blue-700 font-mono truncate">{business.whatsappPhoneNumber ?? business.whatsappPhoneNumberId}</p>
          </div>
          <Button variant="ghost" size="sm" className="text-blue-700 hover:text-blue-900 shrink-0" onClick={() => setEditing(true)}>
            <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
          </Button>
        </div>

        {/* Webhook info (read-only when connected) */}
        <div className="p-3 bg-muted/50 rounded-lg border space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Meta Webhook Config</p>
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
              <code className="flex-1 text-xs bg-background border rounded px-2 py-1.5 font-mono truncate">{business.webhookVerifyToken}</code>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(business.webhookVerifyToken ?? "", "Verify Token")}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">Subscribe to <code className="font-mono">messages</code> field in Meta Developer Console → WhatsApp → Configuration</p>
        </div>
      </div>
    );
  }

  // ── Edit/Setup Form ──
  return (
    <div className="space-y-4">
      {/* Webhook config (shown at top so user can set up Meta first) */}
      <div className="p-3 bg-muted/50 rounded-lg border space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">1. Configure Meta webhook first</p>
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
          <p className="text-xs font-medium mb-1">Verify Token (your token for this business)</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-background border rounded px-2 py-1.5 font-mono truncate">{formData.webhookVerifyToken}</code>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(formData.webhookVerifyToken, "Verify Token")}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <a
          href="https://developers.facebook.com/apps/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Open Meta Developer Console <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Credentials form */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">2. Enter your credentials</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1">Display Phone Number</label>
            <input
              className="w-full text-sm border rounded px-3 py-2 bg-background"
              placeholder="+91 98765 43210"
              value={formData.whatsappPhoneNumber}
              onChange={e => setFormData(p => ({ ...p, whatsappPhoneNumber: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Phone Number ID</label>
            <input
              className="w-full text-sm border rounded px-3 py-2 bg-background font-mono"
              placeholder="1234567890123456"
              value={formData.whatsappPhoneNumberId}
              onChange={e => setFormData(p => ({ ...p, whatsappPhoneNumberId: e.target.value }))}
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">Found in Meta Dev Console → WhatsApp → API Setup</p>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">System User Access Token</label>
          <input
            type="password"
            className="w-full text-sm border rounded px-3 py-2 bg-background font-mono"
            placeholder="EAAB…"
            value={formData.whatsappAccessToken}
            onChange={e => setFormData(p => ({ ...p, whatsappAccessToken: e.target.value }))}
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">Use a permanent System User token — not the temporary test token</p>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          {isConnected && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={testCredentials} disabled={testing || saving}>
            {testing ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Testing…</> : "Test Credentials"}
          </Button>
          <Button size="sm" onClick={save} disabled={saving || testing}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving…</> : "Save & Connect"}
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

  // ── Business Hours state ──
  interface BusinessHoursDraft {
    enabled: boolean;
    timezone: string;
    openTime: string;
    closeTime: string;
    days: number[];
  }

  const parseBusinessHours = (raw: string | null | undefined): BusinessHoursDraft => {
    try {
      if (raw) return JSON.parse(raw) as BusinessHoursDraft;
    } catch { /* ignore */ }
    return { enabled: false, timezone: "Asia/Kolkata", openTime: "09:00", closeTime: "21:00", days: [1, 2, 3, 4, 5, 6] };
  };

  const [editingHours, setEditingHours] = useState(false);
  const [hoursDraft, setHoursDraft] = useState<BusinessHoursDraft>({ enabled: false, timezone: "Asia/Kolkata", openTime: "09:00", closeTime: "21:00", days: [1, 2, 3, 4, 5, 6] });

  const startEditHours = () => {
    setHoursDraft(parseBusinessHours(business?.businessHours));
    setEditingHours(true);
  };

  const saveHours = () => {
    updateBusiness.mutate(
      { id: businessId, data: { businessHours: JSON.stringify(hoursDraft) } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetBusinessQueryKey(businessId), data);
          setEditingHours(false);
          toast({ title: "Business hours saved", description: "AI will adapt its behaviour based on these hours." });
        },
        onError: () => {
          toast({ title: "Save failed", description: "Could not save business hours.", variant: "destructive" });
        },
      }
    );
  };

  const TIMEZONES = [
    { label: "India (IST)", value: "Asia/Kolkata" },
    { label: "UAE (Gulf)", value: "Asia/Dubai" },
    { label: "UK (GMT/BST)", value: "Europe/London" },
    { label: "US Eastern", value: "America/New_York" },
    { label: "US Pacific", value: "America/Los_Angeles" },
    { label: "Singapore", value: "Asia/Singapore" },
    { label: "Australia (AEDT)", value: "Australia/Sydney" },
    { label: "UTC", value: "UTC" },
  ];

  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const toggleDay = (day: number) => {
    setHoursDraft((d) => ({
      ...d,
      days: d.days.includes(day) ? d.days.filter((x) => x !== day) : [...d.days, day].sort(),
    }));
  };

  const deleteBusiness = useMutation({
    mutationFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      await customFetch(`/api/businesses/${businessId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListBusinessesQueryKey() });
      toast({ title: "Business deleted", description: "The business has been permanently removed." });
      setLocation("/businesses");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete business.", variant: "destructive" });
    },
  });

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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="outline" size="icon" className="shrink-0 h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg md:text-2xl font-bold tracking-tight truncate">{business.name}</h1>
              <Badge variant={business.isActive ? "default" : "secondary"} className="shrink-0">
                {business.isActive ? "Active" : "Paused"}
              </Badge>
              {isConnected ? (
                <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50 gap-1 shrink-0">
                  <Wifi className="w-3 h-3" /> Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50 gap-1 shrink-0">
                  <WifiOff className="w-3 h-3" /> Not Connected
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-0.5 truncate">
              {displayPhone ?? business.businessType}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant={business.isActive ? "destructive" : "default"}
            onClick={handleToggle}
            disabled={toggleBot.isPending}
            size="sm"
          >
            {business.isActive ? (
              <><PowerOff className="w-4 h-4 mr-1.5" /> Pause</>
            ) : (
              <><Power className="w-4 h-4 mr-1.5" /> Activate</>
            )}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground">
                <Trash2 className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Delete</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete business?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete <strong>{business.name}</strong> and all its conversations, messages, and settings. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteBusiness.mutate()}
                  disabled={deleteBusiness.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteBusiness.isPending ? "Deleting…" : "Delete business"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
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
        <div className="overflow-x-auto -mx-1 px-1 pb-1">
          <TabsList className="flex w-max md:grid md:w-full md:grid-cols-6 md:max-w-3xl gap-0">
            <TabsTrigger value="connect" className="gap-1 text-xs md:text-sm px-2 md:px-3">
              <Link2 className="w-3 h-3 md:w-3.5 md:h-3.5" /> Connect
            </TabsTrigger>
            <TabsTrigger value="conversations" className="gap-1 text-xs md:text-sm px-2 md:px-3">
              <MessageSquare className="w-3 h-3 md:w-3.5 md:h-3.5" /> Chats
            </TabsTrigger>
            <TabsTrigger value="store" className="gap-1 text-xs md:text-sm px-2 md:px-3">
              <Store className="w-3 h-3 md:w-3.5 md:h-3.5" /> Store
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="gap-1 text-xs md:text-sm px-2 md:px-3">
              <BarChart3 className="w-3 h-3 md:w-3.5 md:h-3.5" /> Knowledge
            </TabsTrigger>
            <TabsTrigger value="contacts" className="gap-1 text-xs md:text-sm px-2 md:px-3">
              <Users className="w-3 h-3 md:w-3.5 md:h-3.5" /> Contacts
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1 text-xs md:text-sm px-2 md:px-3">
              <Settings2 className="w-3 h-3 md:w-3.5 md:h-3.5" /> Settings
            </TabsTrigger>
          </TabsList>
        </div>

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
                      try {
                        await customFetch(`/api/sessions/${businessId}/disconnect`, { method: "POST" });
                      } catch {
                        // Still refresh — DB is updated server-side even on partial failure
                      }
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

        {/* ── Store Sync Tab ── */}
        <TabsContent value="store" className="pt-4">
          <FirebaseSyncTab businessId={businessId} />
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

          {/* Business Hours Card */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Business Hours
                </CardTitle>
                <CardDescription className="mt-1">
                  AI adapts its behaviour based on operating hours. Outside hours it focuses on lead capture.
                </CardDescription>
              </div>
              {!editingHours && (
                <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={startEditHours}>
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {editingHours ? (
                <div className="space-y-5">
                  {/* Enable toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Enable business hours</p>
                      <p className="text-xs text-muted-foreground">When off, AI treats all hours as operating hours.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHoursDraft((d) => ({ ...d, enabled: !d.enabled }))}
                      className={cn(
                        "w-11 h-6 rounded-full transition-colors relative",
                        hoursDraft.enabled ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                    >
                      <span className={cn(
                        "w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-transform",
                        hoursDraft.enabled ? "translate-x-5" : "translate-x-0.5"
                      )} />
                    </button>
                  </div>

                  {hoursDraft.enabled && (
                    <>
                      {/* Timezone */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Timezone</label>
                        <select
                          className="w-full text-sm border rounded px-3 py-2 bg-background"
                          value={hoursDraft.timezone}
                          onChange={(e) => setHoursDraft((d) => ({ ...d, timezone: e.target.value }))}
                        >
                          {TIMEZONES.map((tz) => (
                            <option key={tz.value} value={tz.value}>{tz.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Open/Close times */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Opens at</label>
                          <input
                            type="time"
                            className="w-full text-sm border rounded px-3 py-2 bg-background"
                            value={hoursDraft.openTime}
                            onChange={(e) => setHoursDraft((d) => ({ ...d, openTime: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Closes at</label>
                          <input
                            type="time"
                            className="w-full text-sm border rounded px-3 py-2 bg-background"
                            value={hoursDraft.closeTime}
                            onChange={(e) => setHoursDraft((d) => ({ ...d, closeTime: e.target.value }))}
                          />
                        </div>
                      </div>

                      {/* Days of week */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Open days</label>
                        <div className="flex gap-1.5 flex-wrap">
                          {DAY_LABELS.map((label, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => toggleDay(idx)}
                              className={cn(
                                "w-10 h-10 rounded-lg text-xs font-medium border transition-colors",
                                hoursDraft.days.includes(idx)
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background text-muted-foreground border-border hover:border-primary/50"
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="gap-1.5" onClick={saveHours} disabled={updateBusiness.isPending}>
                      {updateBusiness.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save hours
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setEditingHours(false)} disabled={updateBusiness.isPending}>
                      <X className="w-3.5 h-3.5" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (() => {
                const h = parseBusinessHours(business.businessHours);
                if (!h.enabled) {
                  return (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                      Business hours not configured — AI treats all hours equally.
                    </div>
                  );
                }
                const tzLabel = TIMEZONES.find((t) => t.value === h.timezone)?.label ?? h.timezone;
                const dayNames = h.days.map((d) => DAY_LABELS[d]).join(", ");
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium text-green-700">Hours configured</span>
                    </div>
                    <div className="bg-muted/50 rounded-lg border p-3 text-sm space-y-1">
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-20 text-xs">Hours</span>
                        <span className="font-mono text-xs">{h.openTime} – {h.closeTime}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-20 text-xs">Days</span>
                        <span className="text-xs">{dayNames}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-20 text-xs">Timezone</span>
                        <span className="text-xs">{tzLabel}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Outside these hours, AI captures leads and answers from the knowledge base.</p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>


          {/* AI Configuration Card */}
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
