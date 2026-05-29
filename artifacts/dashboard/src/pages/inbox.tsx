import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useListConversationMessages,
  getListConversationMessagesQueryKey,
} from "@workspace/api-client-react";
import { format, isToday, isYesterday } from "date-fns";
import {
  Search,
  MessageSquare,
  User,
  Bot,
  Wifi,
  WifiOff,
  ChevronRight,
  Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConversationListItem {
  id: number;
  businessId: number;
  businessName: string | null;
  customerPhone: string;
  customerName: string | null;
  updatedAt: string;
  createdAt: string;
  messageCount: number;
  lastMessage: string | null;
  lastMessageAt: string | null;
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

// ─── Chat view ────────────────────────────────────────────────────────────────

function ChatView({ conv }: { conv: ConversationListItem }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useListConversationMessages(conv.id, {
    query: {
      queryKey: getListConversationMessagesQueryKey(conv.id),
      refetchInterval: 4000,
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="h-[60px] bg-[#f0f2f5] border-b border-[#e9edef] px-5 flex items-center gap-3 shrink-0">
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
        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/5 shrink-0">
          AI Bot Active
        </Badge>
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
                <div className={cn("flex mb-0.5", isAI ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[65%] rounded-2xl px-3 py-2 text-sm shadow-sm relative",
                      isAI
                        ? "bg-[#d9fdd3] text-[#111b21] rounded-br-sm"
                        : "bg-white text-[#111b21] rounded-bl-sm"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                    <div className={cn("flex items-center gap-1 mt-0.5", isAI ? "justify-end" : "justify-start")}>
                      <span className="text-[10px] text-[#667781]">
                        {format(new Date(msg.createdAt), "h:mm a")}
                      </span>
                      {isAI && (
                        <Bot className="w-2.5 h-2.5 text-[#667781]" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Fake input */}
      <div className="px-4 py-3 bg-[#f0f2f5] border-t border-[#e9edef] shrink-0">
        <div className="bg-white rounded-full px-4 py-2.5 text-sm text-[#8696a0] flex items-center justify-between">
          <span>AI agent is handling this conversation automatically</span>
          <Bot className="w-4 h-4 text-primary/60" />
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
          <span className="text-[11px] text-[#667781] shrink-0 ml-2">
            {formatConvTime(conv.lastMessageAt || conv.updatedAt)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#667781] truncate max-w-[180px]">
            {conv.lastMessage || `${conv.messageCount} messages`}
          </p>
          {conv.businessName && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full shrink-0 ml-1 truncate max-w-[60px]">
              {conv.businessName}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Main Inbox Page ──────────────────────────────────────────────────────────

export default function Inbox() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const { data: conversations, isLoading } = useQuery<ConversationListItem[]>({
    queryKey: ["conversations-all"],
    queryFn: async () => {
      const res = await fetch("/api/conversations/all");
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
    refetchInterval: 8000,
  });

  const filtered = (conversations ?? []).filter((c) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (c.customerName ?? "").toLowerCase().includes(q) ||
      c.customerPhone.includes(q) ||
      (c.businessName ?? "").toLowerCase().includes(q)
    );
  });

  const selected = filtered.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-full min-h-0">
      {/* Conversation list panel */}
      <div className="w-[340px] shrink-0 flex flex-col border-r border-[#e9edef] bg-white min-h-0">
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
        <div className="px-3 py-2 bg-white border-b border-[#e9edef] shrink-0">
          <div className="bg-[#f0f2f5] rounded-full flex items-center gap-2 px-3 py-1.5">
            <Search className="w-4 h-4 text-[#54656f] shrink-0" />
            <input
              className="flex-1 bg-transparent text-sm text-[#111b21] placeholder-[#8696a0] outline-none"
              placeholder="Search or start new chat"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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

      {/* Chat / Empty state */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {selected ? (
          <ChatView conv={selected} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] gap-4">
            <div className="w-20 h-20 rounded-full bg-[#d9d9d9] flex items-center justify-center">
              <MessageSquare className="w-9 h-9 text-white" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-light text-[#41525d] mb-2">NexusAgent</h2>
              <p className="text-sm text-[#667781] max-w-xs">
                Select a conversation from the left to view the chat thread.
                Your AI agent handles responses automatically.
              </p>
            </div>
            {conversations && conversations.length === 0 && (
              <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 shadow-sm text-sm text-[#54656f]">
                <Building2 className="w-4 h-4 text-primary" />
                Connect a WhatsApp number to start
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
