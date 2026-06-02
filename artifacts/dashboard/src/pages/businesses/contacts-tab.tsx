import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  useListContacts,
  useListBroadcasts,
  useSendBroadcast,
  getListContactsQueryKey,
  getListBroadcastsQueryKey,
  type Contact,
  type Broadcast,
} from "@workspace/api-client-react";
import {
  Users,
  Megaphone,
  Send,
  Loader2,
  Phone,
  Clock,
  CheckCircle2,
  Zap,
  Tag,
  ChevronDown,
  ShieldOff,
  Bot,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

// ─── Tag Config ───────────────────────────────────────────────────────────────

const CONTACT_TAGS = ["PERSONAL", "FAMILY", "STAFF", "SUPPLIER", "CUSTOMER", "LEAD"] as const;
type ContactTagValue = (typeof CONTACT_TAGS)[number];

const TAG_STYLES: Record<ContactTagValue, string> = {
  PERSONAL:  "border-pink-200 text-pink-700 bg-pink-50",
  FAMILY:    "border-rose-200 text-rose-700 bg-rose-50",
  STAFF:     "border-blue-200 text-blue-700 bg-blue-50",
  SUPPLIER:  "border-amber-200 text-amber-700 bg-amber-50",
  CUSTOMER:  "border-green-200 text-green-700 bg-green-50",
  LEAD:      "border-violet-200 text-violet-700 bg-violet-50",
};

const TYPE_STYLES: Record<string, string> = {
  SALES_LEAD:       "border-violet-200 text-violet-700 bg-violet-50",
  CUSTOMER:         "border-green-200 text-green-700 bg-green-50",
  PERSONAL_CONTACT: "border-pink-200 text-pink-700 bg-pink-50",
  FAMILY:           "border-rose-200 text-rose-700 bg-rose-50",
  STAFF:            "border-blue-200 text-blue-700 bg-blue-50",
  SUPPLIER:         "border-amber-200 text-amber-700 bg-amber-50",
  UNKNOWN:          "border-gray-200 text-gray-400 bg-gray-50",
};

const BLOCKED_TAGS = new Set(["PERSONAL", "FAMILY", "STAFF", "SUPPLIER"]);
const BLOCKED_TYPES = new Set(["PERSONAL_CONTACT", "FAMILY", "STAFF", "SUPPLIER"]);

function isAutoReplyBlocked(contact: Contact): boolean {
  if (contact.contactTag && BLOCKED_TAGS.has(contact.contactTag)) return true;
  if (!contact.contactTag && contact.contactType && BLOCKED_TYPES.has(contact.contactType)) return true;
  return false;
}

function threeMonthsAgo(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d;
}

function formatContactType(t: string): string {
  return t.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Components ───────────────────────────────────────────────────────────────

function TagSelector({
  contact,
  onTagChange,
}: {
  contact: Contact;
  onTagChange: (tag: string | null) => void;
}) {
  const currentTag = contact.contactTag as ContactTagValue | null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-6 gap-1 text-[10px] px-1.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Tag className="w-2.5 h-2.5" />
          {currentTag ? formatContactType(currentTag) : "Tag"}
          <ChevronDown className="w-2.5 h-2.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Tag this contact</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {CONTACT_TAGS.map((tag) => (
          <DropdownMenuItem
            key={tag}
            className={cn("text-xs gap-2 cursor-pointer", currentTag === tag && "font-semibold bg-accent")}
            onClick={() => onTagChange(tag)}
          >
            <span className={cn("w-2 h-2 rounded-full shrink-0", {
              "bg-pink-500": tag === "PERSONAL",
              "bg-rose-500": tag === "FAMILY",
              "bg-blue-500": tag === "STAFF",
              "bg-amber-500": tag === "SUPPLIER",
              "bg-green-500": tag === "CUSTOMER",
              "bg-violet-500": tag === "LEAD",
            })} />
            {formatContactType(tag)}
            {BLOCKED_TAGS.has(tag) && (
              <ShieldOff className="w-3 h-3 text-muted-foreground ml-auto" />
            )}
          </DropdownMenuItem>
        ))}
        {currentTag && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs text-muted-foreground cursor-pointer" onClick={() => onTagChange(null)}>
              Clear tag
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ContactRow({
  contact,
  onTagChange,
}: {
  contact: Contact;
  onTagChange: (tag: string | null) => void;
}) {
  const last = new Date(contact.lastSeen);
  const isRecent = last >= threeMonthsAgo();
  const blocked = isAutoReplyBlocked(contact);
  const activeTag = contact.contactTag as ContactTagValue | null;
  const activeType = contact.contactType;

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Phone className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {contact.customerName ?? contact.customerPhone}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {contact.customerName && (
              <p className="text-xs text-muted-foreground">{contact.customerPhone}</p>
            )}
            {/* AI-classified type badge (shown if no manual tag) */}
            {!activeTag && activeType && activeType !== "UNKNOWN" && (
              <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4 leading-none", TYPE_STYLES[activeType] ?? TYPE_STYLES.UNKNOWN)}>
                {formatContactType(activeType)}
              </Badge>
            )}
            {/* Manual tag badge */}
            {activeTag && (
              <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4 leading-none", TAG_STYLES[activeTag])}>
                {formatContactType(activeTag)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Auto-reply status icon */}
        {blocked ? (
          <span title="Auto-reply disabled for this contact">
            <ShieldOff className="w-3.5 h-3.5 text-gray-400" />
          </span>
        ) : isRecent ? (
          <span title="AI will auto-reply to this contact">
            <Bot className="w-3.5 h-3.5 text-primary/60" />
          </span>
        ) : null}

        {/* Recent badge */}
        {isRecent && !blocked && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-green-700 border-green-200 bg-green-50">
            Active
          </Badge>
        )}

        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDistanceToNow(last, { addSuffix: true })}
        </span>

        {/* Tag selector */}
        <TagSelector contact={contact} onTagChange={onTagChange} />
      </div>
    </div>
  );
}

function BroadcastRow({ broadcast }: { broadcast: Broadcast }) {
  return (
    <div className="border rounded-lg p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {broadcast.triggerChunkId ? (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-purple-700 border-purple-200 bg-purple-50 gap-1">
              <Zap className="w-2.5 h-2.5" /> Auto
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-blue-700 border-blue-200 bg-blue-50 gap-1">
              <Send className="w-2.5 h-2.5" /> Manual
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(broadcast.createdAt), { addSuffix: true })}
          </span>
        </div>
        <span className="text-xs font-medium flex items-center gap-1 text-green-700">
          <CheckCircle2 className="w-3 h-3" />
          {broadcast.recipientCount} sent
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{broadcast.message}</p>
    </div>
  );
}

function ManualBroadcastForm({
  businessId,
  recipientCount,
  onSuccess,
}: {
  businessId: number;
  recipientCount: number;
  onSuccess: () => void;
}) {
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  const send = useSendBroadcast();

  const handleSend = () => {
    if (!message.trim()) return;
    send.mutate(
      { id: businessId, data: { message: message.trim() } },
      {
        onSuccess: (broadcast) => {
          toast({
            title: "Broadcast sent",
            description: `Delivered to ${broadcast.recipientCount} customer${broadcast.recipientCount !== 1 ? "s" : ""}.`,
          });
          setMessage("");
          onSuccess();
        },
        onError: () => {
          toast({ title: "Broadcast failed", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
      <p className="text-sm font-semibold flex items-center gap-1.5">
        <Megaphone className="w-4 h-4 text-primary" />
        Send Broadcast
      </p>
      <Textarea
        rows={4}
        className="text-sm resize-none"
        placeholder="Type your message to all recent customers…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={1000}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Will be sent to <span className="font-medium">{recipientCount}</span> customer{recipientCount !== 1 ? "s" : ""} active in the last 3 months
        </p>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={handleSend}
          disabled={!message.trim() || send.isPending}
        >
          {send.isPending ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</>
          ) : (
            <><Send className="w-3.5 h-3.5" /> Send</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function ContactsTab({ businessId }: { businessId: number }) {
  const queryClient = useQueryClient();
  const [showBroadcastForm, setShowBroadcastForm] = useState(false);
  const { toast } = useToast();

  const { data: contacts, isLoading: contactsLoading } = useListContacts(businessId, {
    query: { enabled: !!businessId, queryKey: getListContactsQueryKey(businessId) },
  });

  const { data: broadcasts, isLoading: broadcastsLoading } = useListBroadcasts(businessId, {
    query: { enabled: !!businessId, queryKey: getListBroadcastsQueryKey(businessId) },
  });

  const setTagMutation = useMutation({
    mutationFn: ({ conversationId, contactTag }: { conversationId: number; contactTag: string | null }) =>
      customFetch(`/api/conversations/${conversationId}/contact-tag`, {
        method: "PATCH",
        body: JSON.stringify({ contactTag }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListContactsQueryKey(businessId) });
      toast({ title: "Contact tagged", description: "Auto-reply settings updated." });
    },
    onError: () => {
      toast({ title: "Failed to update tag", variant: "destructive" });
    },
  });

  const recentCount =
    contacts?.filter(
      (c) => !isAutoReplyBlocked(c) && new Date(c.lastSeen) >= threeMonthsAgo()
    ).length ?? 0;

  const handleBroadcastSuccess = () => {
    queryClient.invalidateQueries({ queryKey: getListBroadcastsQueryKey(businessId) });
    setShowBroadcastForm(false);
  };

  // Stats
  const blockedCount = contacts?.filter(isAutoReplyBlocked).length ?? 0;

  return (
    <div className="grid md:grid-cols-2 gap-4 items-start">
      {/* Contacts */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Contacts
            </CardTitle>
            <CardDescription className="mt-1">
              All contacts who have messaged this business.{" "}
              <span className="font-medium text-foreground">{recentCount}</span> active with auto-reply on.
              {blockedCount > 0 && (
                <span className="ml-1">
                  <span className="font-medium text-gray-500">{blockedCount}</span> blocked from auto-reply.
                </span>
              )}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {/* Legend */}
          <div className="flex items-center gap-3 mb-3 pb-3 border-b flex-wrap">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Tags:</span>
            {CONTACT_TAGS.map((tag) => (
              <span key={tag} className={cn("text-[9px] border px-1.5 py-0.5 rounded-full leading-none flex items-center gap-1", TAG_STYLES[tag])}>
                {BLOCKED_TAGS.has(tag) && <ShieldOff className="w-2.5 h-2.5" />}
                {formatContactType(tag)}
              </span>
            ))}
          </div>

          {contactsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !contacts || contacts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm font-medium">No contacts yet</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Phone numbers of customers who message your business via WhatsApp will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {contacts.map((c) => (
                <ContactRow
                  key={c.customerPhone}
                  contact={c}
                  onTagChange={(tag) =>
                    setTagMutation.mutate({ conversationId: c.conversationId, contactTag: tag })
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Broadcasts */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-primary" />
                Broadcasts
              </CardTitle>
              <CardDescription className="mt-1">
                Messages sent to recent customers. Product additions trigger automatic broadcasts.
              </CardDescription>
            </div>
            {!showBroadcastForm && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 shrink-0"
                onClick={() => setShowBroadcastForm(true)}
                disabled={recentCount === 0}
                title={recentCount === 0 ? "No recent customers to broadcast to" : undefined}
              >
                <Send className="w-3.5 h-3.5" /> Broadcast
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {showBroadcastForm && (
              <ManualBroadcastForm
                businessId={businessId}
                recipientCount={recentCount}
                onSuccess={handleBroadcastSuccess}
              />
            )}
            {broadcastsLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : !broadcasts || broadcasts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Megaphone className="w-8 h-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No broadcasts yet</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Broadcasts are sent automatically when you add a product to the Knowledge Base, or you can send one manually above.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {broadcasts.map((b) => (
                  <BroadcastRow key={b.id} broadcast={b} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
