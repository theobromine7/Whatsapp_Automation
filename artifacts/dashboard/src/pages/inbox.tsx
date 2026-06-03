import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  useListConversationMessages,
  getListConversationMessagesQueryKey,
  customFetch,
} from "@workspace/api-client-react";
import { format, isToday, isYesterday } from "date-fns";
import {
  Search,
  MessageSquare,
  Bot,
  UserCheck,
  Play,
  Tag,
  ShieldOff,
  ChevronDown,
  Send,
  Sparkles,
  Ban,
  User,
  AlertTriangle,
  X,
  CheckCheck,
  Paperclip,
  ImageIcon,
  ArrowLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type AiState = "NEW_LEAD" | "AI_ACTIVE" | "OWNER_TAKEN_OVER" | "PERSONAL_CONTACT" | "BLOCKED";

interface ConversationListItem {
  id: number;
  businessId: number;
  businessName: string | null;
  customerPhone: string;
  customerName: string | null;
  aiState: AiState;
  contactType: string | null;
  contactTag: string | null;
  ownerLastMessageAt: string | null;
  updatedAt: string;
  createdAt: string;
  messageCount: number;
  lastMessage: string | null;
  lastMessageAt: string | null;
  pendingHumanReview: boolean;
  lastDetectedIntent: string | null;
}

// ─── AI State Config ──────────────────────────────────────────────────────────

interface AiStateConfig {
  label: string;
  badgeClass: string;
  icon: React.ElementType;
  stripText: string;
  stripClass: string;
  stripIcon: React.ElementType;
  showResumeBtn: boolean;
}

const AI_STATE_CONFIG: Record<AiState, AiStateConfig> = {
  NEW_LEAD: {
    label: "New Lead",
    badgeClass: "border-violet-300 text-violet-700 bg-violet-50",
    icon: Sparkles,
    stripText: "New lead — AI agent will reply automatically",
    stripClass: "text-violet-700",
    stripIcon: Sparkles,
    showResumeBtn: false,
  },
  AI_ACTIVE: {
    label: "AI Active",
    badgeClass: "border-primary/30 text-primary bg-primary/5",
    icon: Bot,
    stripText: "AI agent is handling replies automatically",
    stripClass: "text-[#8696a0]",
    stripIcon: Bot,
    showResumeBtn: false,
  },
  OWNER_TAKEN_OVER: {
    label: "Human Active",
    badgeClass: "border-orange-400/60 text-orange-600 bg-orange-50",
    icon: UserCheck,
    stripText: "You're handling this chat · AI resumes in 30 min",
    stripClass: "text-orange-700",
    stripIcon: UserCheck,
    showResumeBtn: true,
  },
  PERSONAL_CONTACT: {
    label: "Personal",
    badgeClass: "border-pink-300 text-pink-700 bg-pink-50",
    icon: User,
    stripText: "Personal contact — auto-reply is off",
    stripClass: "text-pink-700",
    stripIcon: User,
    showResumeBtn: false,
  },
  BLOCKED: {
    label: "Blocked",
    badgeClass: "border-red-300 text-red-600 bg-red-50",
    icon: Ban,
    stripText: "Blocked — AI will never reply to this contact",
    stripClass: "text-red-600",
    stripIcon: Ban,
    showResumeBtn: false,
  },
};

function getStateConfig(aiState: string): AiStateConfig {
  return AI_STATE_CONFIG[aiState as AiState] ?? AI_STATE_CONFIG.AI_ACTIVE;
}

// ─── Contact Tag Config ───────────────────────────────────────────────────────

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
  UNKNOWN:          "border-gray-200 text-gray-500 bg-gray-50",
};

function displayLabel(conv: ConversationListItem): string | null {
  if (conv.contactTag) return conv.contactTag.charAt(0) + conv.contactTag.slice(1).toLowerCase();
  if (conv.contactType) return conv.contactType.replace(/_/g, " ").charAt(0) + conv.contactType.replace(/_/g, " ").slice(1).toLowerCase();
  return null;
}

function badgeStyle(conv: ConversationListItem): string {
  if (conv.contactTag) return TAG_STYLES[conv.contactTag as ContactTagValue] ?? TAG_STYLES.CUSTOMER;
  if (conv.contactType) return TYPE_STYLES[conv.contactType] ?? TYPE_STYLES.UNKNOWN;
  return "";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatConvTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d");
}

function getInitials(name: string | null, phone: string): string {
  if (name) return name.charAt(0).toUpperCase();
  return phone.charAt(0);
}

const AVATAR_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-amber-500",
  "bg-rose-500", "bg-emerald-500", "bg-cyan-500",
  "bg-orange-500", "bg-pink-500",
];

function avatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

// ─── Contact Tag Selector ─────────────────────────────────────────────────────

function ContactTagSelector({
  conv,
  onTagChange,
}: {
  conv: ConversationListItem;
  onTagChange: (tag: string | null) => void;
}) {
  const BLOCKED_TAGS = new Set(["PERSONAL", "FAMILY", "STAFF", "SUPPLIER"]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs px-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Tag className="w-3 h-3" />
          {conv.contactTag
            ? conv.contactTag.charAt(0) + conv.contactTag.slice(1).toLowerCase()
            : "Tag"}
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs text-muted-foreground">Tag this contact</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {CONTACT_TAGS.map((tag) => (
          <DropdownMenuItem
            key={tag}
            className={cn("text-xs gap-2", conv.contactTag === tag && "font-semibold")}
            onClick={() => onTagChange(tag)}
          >
            <span className={cn("w-2 h-2 rounded-full", {
              "bg-pink-500": tag === "PERSONAL",
              "bg-rose-500": tag === "FAMILY",
              "bg-blue-500": tag === "STAFF",
              "bg-amber-500": tag === "SUPPLIER",
              "bg-green-500": tag === "CUSTOMER",
              "bg-violet-500": tag === "LEAD",
            })} />
            {tag.charAt(0) + tag.slice(1).toLowerCase()}
            {BLOCKED_TAGS.has(tag) && <span className="text-[10px] text-muted-foreground ml-auto">no auto-reply</span>}
          </DropdownMenuItem>
        ))}
        {conv.contactTag && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs text-muted-foreground" onClick={() => onTagChange(null)}>
              Clear tag
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── AI State Selector ────────────────────────────────────────────────────────

function AiStateSelector({
  conv,
  onStateChange,
}: {
  conv: ConversationListItem;
  onStateChange: (state: AiState) => void;
}) {
  const cfg = getStateConfig(conv.aiState);
  const Icon = cfg.icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Badge
          variant="outline"
          className={cn("text-[10px] gap-1 cursor-pointer hover:opacity-80 shrink-0", cfg.badgeClass)}
          onClick={(e) => e.stopPropagation()}
        >
          <Icon className="w-2.5 h-2.5" />
          {cfg.label}
          <ChevronDown className="w-2.5 h-2.5 opacity-60" />
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs text-muted-foreground">Set automation state</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(["NEW_LEAD", "AI_ACTIVE", "OWNER_TAKEN_OVER", "PERSONAL_CONTACT", "BLOCKED"] as AiState[]).map((state) => {
          const s = AI_STATE_CONFIG[state];
          const SIcon = s.icon;
          return (
            <DropdownMenuItem
              key={state}
              className={cn("text-xs gap-2", conv.aiState === state && "font-semibold")}
              onClick={() => onStateChange(state)}
            >
              <SIcon className="w-3 h-3 opacity-70" />
              {s.label}
              {conv.aiState === state && <span className="text-[10px] text-muted-foreground ml-auto">current</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Chat view ────────────────────────────────────────────────────────────────

function ChatView({
  conv,
  onTagChange,
  onStateChange,
  onBack,
}: {
  conv: ConversationListItem;
  onTagChange: (tag: string | null) => void;
  onStateChange: (state: AiState) => void;
  onBack?: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [inputText, setInputText] = useState("");
  const [mediaPreview, setMediaPreview] = useState<{ dataUrl: string; mimeType: string; caption: string } | null>(null);

  const cfg = getStateConfig(conv.aiState);
  const StripIcon = cfg.stripIcon;
  const label = displayLabel(conv);

  const { data: messages, isLoading } = useListConversationMessages(conv.id, {
    query: {
      queryKey: getListConversationMessagesQueryKey(conv.id),
      refetchInterval: 4000,
    },
  });

  const resumeAI = useMutation({
    mutationFn: () =>
      customFetch(`/api/conversations/${conv.id}/ai-state`, {
        method: "PATCH",
        body: JSON.stringify({ aiState: "AI_ACTIVE" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations-all"] });
    },
  });

  const dismissReview = useMutation({
    mutationFn: () =>
      customFetch(`/api/conversations/${conv.id}/dismiss-review`, {
        method: "PATCH",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations-all"] });
    },
  });

  const sendOwnerMessage = useMutation({
    mutationFn: (text: string) =>
      customFetch(`/api/conversations/${conv.id}/owner-message`, {
        method: "POST",
        body: JSON.stringify({ text }),
      }),
    onSuccess: () => {
      setInputText("");
      queryClient.invalidateQueries({ queryKey: getListConversationMessagesQueryKey(conv.id) });
      queryClient.invalidateQueries({ queryKey: ["conversations-all"] });
    },
  });

  const sendOwnerMedia = useMutation({
    mutationFn: ({ data, mimeType, caption }: { data: string; mimeType: string; caption: string }) =>
      customFetch(`/api/conversations/${conv.id}/owner-media`, {
        method: "POST",
        body: JSON.stringify({ data, mimeType, caption: caption || undefined }),
      }),
    onSuccess: () => {
      setMediaPreview(null);
      queryClient.invalidateQueries({ queryKey: getListConversationMessagesQueryKey(conv.id) });
      queryClient.invalidateQueries({ queryKey: ["conversations-all"] });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setMediaPreview({ dataUrl: reader.result as string, mimeType: file.type, caption: "" });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSendMedia = () => {
    if (!mediaPreview || sendOwnerMedia.isPending) return;
    sendOwnerMedia.mutate({ data: mediaPreview.dataUrl, mimeType: mediaPreview.mimeType, caption: mediaPreview.caption });
  };

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || sendOwnerMessage.isPending) return;
    sendOwnerMessage.mutate(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full relative">
      {/* Chat header */}
      <div className="h-[60px] bg-[#f0f2f5] border-b border-[#e9edef] px-3 md:px-5 flex items-center gap-2 md:gap-3 shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-full text-[#54656f] hover:bg-black/5 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0", avatarColor(conv.id))}>
          {getInitials(conv.customerName, conv.customerPhone)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#111b21] text-sm truncate">
            {conv.customerName || conv.customerPhone}
          </p>
          <p className="text-xs text-[#667781] font-mono truncate">
            {conv.customerPhone} · {conv.businessName}
          </p>
        </div>

        {/* Contact type/tag badge */}
        {label && (
          <Badge variant="outline" className={cn("text-[10px] px-1.5 shrink-0", badgeStyle(conv))}>
            {label}
          </Badge>
        )}

        {/* Tag selector */}
        <ContactTagSelector conv={conv} onTagChange={onTagChange} />

        {/* AI state selector — click to change state */}
        <AiStateSelector conv={conv} onStateChange={onStateChange} />
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
        style={{
          background: "#efeae2",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cpath fill='none' stroke='%23d9d2ca' stroke-width='0.5' d='M0 40h80M40 0v80'/%3E%3C/svg%3E")`,
        }}
      >
        {isLoading ? (
          <div className="space-y-3 pt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}>
                <Skeleton className="h-12 w-56 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="bg-white/80 rounded-xl px-6 py-3 text-sm text-[#667781] text-center shadow-sm">
              No messages yet
            </div>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isAI = msg.role === "assistant";
            const isOwner = msg.role === "owner";
            const isRight = isAI || isOwner;
            const prevMsg = messages[i - 1];
            const showTime = !prevMsg || new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() > 5 * 60 * 1000;

            return (
              <div key={msg.id}>
                {showTime && (
                  <div className="flex justify-center my-3">
                    <span className="bg-white/80 text-[#667781] text-[11px] px-3 py-1 rounded-full shadow-sm">
                      {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                )}
                <div className={cn("flex mb-0.5", isRight ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[65%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                      isOwner
                        ? "bg-[#2a3942] text-white rounded-br-sm"
                        : isAI
                        ? "bg-[#d9fdd3] text-[#111b21] rounded-br-sm"
                        : "bg-white text-[#111b21] rounded-bl-sm"
                    )}
                  >
                    {msg.content.startsWith("📷") ? (
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", isOwner ? "bg-white/10" : "bg-black/5")}>
                          <ImageIcon className={cn("w-5 h-5", isOwner ? "text-white/70" : "text-[#667781]")} />
                        </div>
                        <span className={cn("text-sm", isOwner ? "text-white/90" : "text-[#111b21]")}>
                          {msg.content === "📷 Photo" ? "Photo" : msg.content.replace("📷 ", "")}
                        </span>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                    )}
                    <div className={cn("flex items-center gap-1 mt-0.5", isRight ? "justify-end" : "justify-start")}>
                      <span className={cn("text-[10px]", isOwner ? "text-white/60" : "text-[#667781]")}>
                        {format(new Date(msg.createdAt), "h:mm a")}
                      </span>
                      {isAI && <Bot className="w-2.5 h-2.5 text-[#667781]" />}
                      {isOwner && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Pending Review Banner */}
      {conv.pendingHumanReview && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-800">Needs your attention</p>
            {conv.lastDetectedIntent && (
              <p className="text-xs text-amber-700 truncate">
                AI wasn't confident about: <span className="italic">{conv.lastDetectedIntent}</span>
              </p>
            )}
            <p className="text-xs text-amber-600 mt-0.5">Reply manually or Resume AI to continue.</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 shrink-0 text-amber-600 hover:bg-amber-100"
            onClick={() => dismissReview.mutate()}
            disabled={dismissReview.isPending}
            title="Dismiss review flag"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Bottom bar — status strip + message input */}
      <div className="bg-[#f0f2f5] border-t border-[#e9edef] shrink-0">
        {/* Status strip */}
        <div className="px-4 pt-2 pb-1 flex items-center justify-between gap-3">
          <div className={cn("flex items-center gap-2 text-xs", cfg.stripClass)}>
            <StripIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{cfg.stripText}</span>
          </div>

          {cfg.showResumeBtn && (
            <Button
              size="sm"
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-100 shrink-0 h-6 text-xs gap-1 px-2"
              onClick={() => resumeAI.mutate()}
              disabled={resumeAI.isPending}
            >
              <Play className="w-3 h-3" />
              Resume AI
            </Button>
          )}
        </div>

        {/* Image preview modal */}
        {mediaPreview && (
          <div className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-sm">
              <div className="bg-[#f0f2f5] px-4 py-3 flex items-center justify-between border-b border-[#e9edef]">
                <span className="font-semibold text-[#111b21] text-sm">Send Photo</span>
                <button onClick={() => setMediaPreview(null)} className="text-[#667781] hover:text-[#111b21]">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
                <img src={mediaPreview.dataUrl} alt="preview" className="w-full max-h-64 object-contain rounded-xl bg-[#f0f2f5]" />
                <input
                  className="w-full mt-3 bg-[#f0f2f5] rounded-xl px-4 py-2.5 text-sm text-[#111b21] placeholder-[#8696a0] outline-none"
                  placeholder="Add a caption… (optional)"
                  value={mediaPreview.caption}
                  onChange={(e) => setMediaPreview({ ...mediaPreview, caption: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSendMedia(); }}
                />
              </div>
              <div className="px-4 pb-4 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setMediaPreview(null)}>Cancel</Button>
                <Button className="flex-1 gap-2" onClick={handleSendMedia} disabled={sendOwnerMedia.isPending}>
                  <Send className="w-4 h-4" />
                  {sendOwnerMedia.isPending ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Message input */}
        <div className="px-3 pb-3 flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            className="w-10 h-10 rounded-full bg-white border border-[#e9edef] flex items-center justify-center text-[#8696a0] hover:text-primary hover:border-primary/30 transition-colors shrink-0"
            onClick={() => fileInputRef.current?.click()}
            title="Send photo"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <textarea
            ref={inputRef}
            rows={1}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a reply… (Enter to send, Shift+Enter for new line)"
            className="flex-1 bg-white rounded-2xl px-4 py-2.5 text-sm text-[#111b21] placeholder-[#8696a0] outline-none border border-[#e9edef] resize-none overflow-hidden leading-relaxed"
            style={{ minHeight: "42px" }}
          />
          <Button
            size="icon"
            className="w-10 h-10 rounded-full shrink-0"
            onClick={handleSend}
            disabled={!inputText.trim() || sendOwnerMessage.isPending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Conversation List Item ───────────────────────────────────────────────────

function ConvItem({
  conv,
  isActive,
  onClick,
}: {
  conv: ConversationListItem;
  isActive: boolean;
  onClick: () => void;
}) {
  const cfg = getStateConfig(conv.aiState);
  const StateIcon = cfg.icon;
  const label = displayLabel(conv);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-[#e9edef]",
        isActive ? "bg-[#f0f2f5]" : "bg-white hover:bg-[#f5f6f6]"
      )}
    >
      <div className={cn("w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold shrink-0", avatarColor(conv.id))}>
        {getInitials(conv.customerName, conv.customerPhone)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="font-semibold text-sm text-[#111b21] truncate">
            {conv.customerName || conv.customerPhone}
          </span>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <span title={cfg.label}>
              <StateIcon className={cn("w-3 h-3", {
                "text-violet-500": conv.aiState === "NEW_LEAD",
                "text-primary": conv.aiState === "AI_ACTIVE",
                "text-orange-500": conv.aiState === "OWNER_TAKEN_OVER",
                "text-pink-500": conv.aiState === "PERSONAL_CONTACT",
                "text-red-500": conv.aiState === "BLOCKED",
              })} />
            </span>
            <span className="text-[11px] text-[#667781]">
              {formatConvTime(conv.lastMessageAt || conv.updatedAt)}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs text-[#667781] truncate max-w-[160px]">
            {conv.lastMessage || `${conv.messageCount} messages`}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            {conv.pendingHumanReview && (
              <span className="flex items-center gap-0.5 text-[9px] font-semibold bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full shrink-0 leading-none">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                Review
              </span>
            )}
            {label && (
              <span className={cn("text-[9px] border px-1 py-0.5 rounded-full leading-none", badgeStyle(conv))}>
                {label}
              </span>
            )}
            {conv.businessName && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full truncate max-w-[60px]">
                {conv.businessName}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Main Inbox Page ──────────────────────────────────────────────────────────

type FilterCategory = "ALL" | "LEADS" | "CUSTOMERS" | "PERSONAL" | "FAMILY" | "STAFF" | "SUPPLIER" | "REVIEW";

const FILTER_CHIPS: { id: FilterCategory; label: string }[] = [
  { id: "ALL",      label: "All" },
  { id: "REVIEW",   label: "Review" },
  { id: "LEADS",    label: "Leads" },
  { id: "CUSTOMERS",label: "Customers" },
  { id: "PERSONAL", label: "Personal" },
  { id: "FAMILY",   label: "Family" },
  { id: "STAFF",    label: "Staff" },
  { id: "SUPPLIER", label: "Supplier" },
];

function matchesFilter(conv: ConversationListItem, cat: FilterCategory): boolean {
  if (cat === "ALL") return true;
  if (cat === "REVIEW") return conv.pendingHumanReview;
  if (cat === "LEADS") return conv.contactType === "SALES_LEAD" || conv.contactTag === "LEAD";
  if (cat === "CUSTOMERS") return conv.contactType === "CUSTOMER" || conv.contactTag === "CUSTOMER";
  if (cat === "PERSONAL") return conv.contactType === "PERSONAL_CONTACT" || conv.contactTag === "PERSONAL";
  if (cat === "FAMILY") return conv.contactTag === "FAMILY";
  if (cat === "STAFF") return conv.contactTag === "STAFF";
  if (cat === "SUPPLIER") return conv.contactTag === "SUPPLIER";
  return true;
}

export default function Inbox() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<FilterCategory>("ALL");
  const queryClient = useQueryClient();

  const { data: conversations, isLoading } = useQuery<ConversationListItem[]>({
    queryKey: ["conversations-all"],
    queryFn: () =>
      customFetch<ConversationListItem[]>("/api/conversations/all", { responseType: "json" }),
    refetchInterval: 8000,
  });

  const setTagMutation = useMutation({
    mutationFn: ({ id, contactTag }: { id: number; contactTag: string | null }) =>
      customFetch(`/api/conversations/${id}/contact-tag`, {
        method: "PATCH",
        body: JSON.stringify({ contactTag }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations-all"] });
    },
  });

  const setStateMutation = useMutation({
    mutationFn: ({ id, aiState }: { id: number; aiState: AiState }) =>
      customFetch(`/api/conversations/${id}/ai-state`, {
        method: "PATCH",
        body: JSON.stringify({ aiState }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations-all"] });
    },
  });

  const filtered = (conversations ?? []).filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      (c.customerName ?? "").toLowerCase().includes(q) ||
      c.customerPhone.includes(q) ||
      (c.businessName ?? "").toLowerCase().includes(q);
    return matchesSearch && matchesFilter(c, filterCat);
  });

  const selected = filtered.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-full min-h-0">
      {/* Conversation list panel — full-width on mobile when no chat open */}
      <div className={cn(
        "flex flex-col border-r border-[#e9edef] bg-white min-h-0",
        "w-full md:w-[340px] md:shrink-0",
        selectedId ? "hidden md:flex" : "flex"
      )}>
        {/* Header */}
        <div className="h-[60px] bg-[#f0f2f5] border-b border-[#e9edef] px-4 flex items-center justify-between shrink-0">
          <h1 className="font-semibold text-[#111b21] text-base">Inbox</h1>
          <div className="flex items-center gap-1 text-[#54656f]">
            {conversations && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {conversations.length}
              </span>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="px-3 pt-2 pb-1.5 bg-white border-b border-[#e9edef] shrink-0">
          <div className="bg-[#f0f2f5] rounded-full flex items-center gap-2 px-3 py-1.5">
            <Search className="w-4 h-4 text-[#54656f] shrink-0" />
            <input
              className="flex-1 bg-transparent text-sm text-[#111b21] placeholder-[#8696a0] outline-none"
              placeholder="Search or start new chat"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {/* Filter chips */}
          <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 scrollbar-none">
            {FILTER_CHIPS.map((chip) => {
              const count = chip.id === "ALL"
                ? (conversations?.length ?? 0)
                : (conversations ?? []).filter((c) => matchesFilter(c, chip.id)).length;
              if (chip.id !== "ALL" && count === 0) return null;
              return (
                <button
                  key={chip.id}
                  onClick={() => setFilterCat(chip.id)}
                  className={cn(
                    "shrink-0 text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors",
                    filterCat === chip.id
                      ? "bg-[#00a884] border-[#00a884] text-white"
                      : "bg-white border-[#e9edef] text-[#54656f] hover:bg-[#f5f6f6]"
                  )}
                >
                  {chip.label}
                  {count > 0 && (
                    <span className={cn("ml-1", filterCat === chip.id ? "opacity-80" : "opacity-60")}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-0">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[#e9edef]">
                  <Skeleton className="w-11 h-11 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
              <MessageSquare className="w-10 h-10 text-[#c4c4c4]" />
              <p className="text-sm text-[#667781]">
                {search ? "No conversations match your search" : "No conversations yet"}
              </p>
              {!search && (
                <p className="text-xs text-[#8696a0]">
                  Connect a WhatsApp number to start receiving messages
                </p>
              )}
            </div>
          ) : (
            filtered.map((conv) => (
              <ConvItem
                key={conv.id}
                conv={conv}
                isActive={conv.id === selectedId}
                onClick={() => setSelectedId(conv.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Chat panel — full-width on mobile when a chat is open */}
      <div className={cn(
        "flex-1 min-w-0 min-h-0 flex flex-col",
        selectedId ? "flex" : "hidden md:flex"
      )}>
        {selected ? (
          <ChatView
            key={selected.id}
            conv={selected}
            onBack={() => setSelectedId(null)}
            onTagChange={(tag) => setTagMutation.mutate({ id: selected.id, contactTag: tag })}
            onStateChange={(state) => setStateMutation.mutate({ id: selected.id, aiState: state })}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center bg-[#f0f2f5]">
            <div className="w-20 h-20 rounded-full bg-white/80 flex items-center justify-center shadow-sm">
              <MessageSquare className="w-9 h-9 text-[#c4c4c4]" />
            </div>
            <div>
              <p className="font-semibold text-[#111b21] text-base">Select a conversation</p>
              <p className="text-sm text-[#667781] mt-1">Choose a chat from the list to view messages</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-2 max-w-xs">
              {(["NEW_LEAD", "AI_ACTIVE", "OWNER_TAKEN_OVER", "PERSONAL_CONTACT", "BLOCKED"] as AiState[]).map((state) => {
                const s = AI_STATE_CONFIG[state];
                const SIcon = s.icon;
                return (
                  <Badge key={state} variant="outline" className={cn("text-[10px] gap-1", s.badgeClass)}>
                    <SIcon className="w-2.5 h-2.5" />
                    {s.label}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
