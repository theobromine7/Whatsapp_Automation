import { useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import {
  getListConversationMessagesQueryKey,
  useListConversationMessages,
  getGetBusinessQueryKey,
  useGetBusiness,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { ArrowLeft, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function ConversationDetail() {
  const [, params] = useRoute("/conversations/:businessId/:conversationId");
  const businessId = parseInt(params?.businessId || "0", 10);
  const conversationId = parseInt(params?.conversationId || "0", 10);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: business } = useGetBusiness(businessId, {
    query: { enabled: !!businessId, queryKey: getGetBusinessQueryKey(businessId) },
  });

  const { data: messages, isLoading } = useListConversationMessages(conversationId, {
    query: {
      enabled: !!conversationId,
      queryKey: getListConversationMessagesQueryKey(conversationId),
      refetchInterval: 4000,
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-[60px] bg-[#f0f2f5] border-b border-[#e9edef] px-5 flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="w-40 h-4" />
        </div>
        <div className="flex-1 flex flex-col gap-3 p-4" style={{ background: "#efeae2" }}>
          <Skeleton className="h-12 w-56 rounded-2xl self-start" />
          <Skeleton className="h-16 w-64 rounded-2xl self-end" />
          <Skeleton className="h-10 w-44 rounded-2xl self-start" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="h-[60px] bg-[#f0f2f5] border-b border-[#e9edef] px-4 flex items-center gap-3 shrink-0">
        <Link href={`/businesses/${businessId}`}>
          <Button variant="ghost" size="icon" className="w-8 h-8 shrink-0 text-[#54656f] hover:bg-[#e9edef]">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#111b21] text-sm">{business?.name}</p>
          <p className="text-xs text-[#667781]">
            Conversation #{conversationId}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px]",
            business?.isActive
              ? "border-green-200 text-green-700 bg-green-50"
              : "border-gray-200 text-gray-500"
          )}
        >
          {business?.isActive ? "Bot Active" : "Paused"}
        </Badge>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
        style={{ background: "#efeae2" }}
      >
        {!messages || messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="bg-white/80 rounded-xl px-6 py-3 text-sm text-[#667781] shadow-sm">
              No messages yet
            </div>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isAI = msg.role === "assistant";
            const prev = messages[i - 1];
            const showTime =
              !prev ||
              new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000;

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
                      "max-w-[65%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                      isAI
                        ? "bg-[#d9fdd3] text-[#111b21] rounded-br-sm"
                        : "bg-white text-[#111b21] rounded-bl-sm"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words leading-relaxed">
                      {msg.content}
                    </p>
                    <div className={cn("flex items-center gap-1 mt-0.5", isAI ? "justify-end" : "justify-start")}>
                      <span className="text-[10px] text-[#667781]">
                        {format(new Date(msg.createdAt), "h:mm a")}
                      </span>
                      {isAI && <Bot className="w-2.5 h-2.5 text-[#667781]" />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Bot status bar */}
      <div className="px-4 py-3 bg-[#f0f2f5] border-t border-[#e9edef] shrink-0">
        <div className="bg-white rounded-full px-4 py-2.5 text-sm text-[#8696a0] flex items-center justify-between">
          <span>AI agent is handling this conversation automatically</span>
          <Bot className="w-4 h-4 text-primary/60" />
        </div>
      </div>
    </div>
  );
}
