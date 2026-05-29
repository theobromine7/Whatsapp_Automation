import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListKnowledgeChunks,
  useCreateKnowledgeChunk,
  useDeleteKnowledgeChunk,
  getListKnowledgeChunksQueryKey,
  type KnowledgeChunk,
} from "@workspace/api-client-react";
import {
  BookOpen,
  Plus,
  Trash2,
  Loader2,
  FileText,
  HelpCircle,
  ShoppingBag,
  Shield,
  File,
  ChevronDown,
  ChevronUp,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const SOURCE_TYPES = [
  { value: "document", label: "Document", icon: FileText, color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "faq", label: "FAQ", icon: HelpCircle, color: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "product", label: "Product", icon: ShoppingBag, color: "bg-green-50 text-green-700 border-green-200" },
  { value: "policy", label: "Policy", icon: Shield, color: "bg-orange-50 text-orange-700 border-orange-200" },
  { value: "other", label: "Other", icon: File, color: "bg-gray-50 text-gray-700 border-gray-200" },
] as const;

type SourceType = typeof SOURCE_TYPES[number]["value"];

function sourceTypeMeta(type: string) {
  return SOURCE_TYPES.find((s) => s.value === type) ?? SOURCE_TYPES[SOURCE_TYPES.length - 1];
}

function ChunkCard({
  chunk,
  onDelete,
  deleting,
}: {
  chunk: KnowledgeChunk;
  onDelete: (id: number) => void;
  deleting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = sourceTypeMeta(chunk.sourceType);
  const Icon = meta.icon;
  const preview = chunk.content.length > 160 ? chunk.content.slice(0, 160) + "…" : chunk.content;

  return (
    <div className="border rounded-lg p-4 bg-background hover:bg-muted/20 transition-colors group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={cn("w-8 h-8 rounded-md border flex items-center justify-center shrink-0 mt-0.5", meta.color)}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm truncate">{chunk.title}</p>
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5 border shrink-0", meta.color)}>
                {meta.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {expanded ? chunk.content : preview}
            </p>
            {chunk.content.length > 160 && (
              <button
                className="text-xs text-primary mt-1 flex items-center gap-0.5 hover:underline"
                onClick={() => setExpanded((e) => !e)}
              >
                {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show more</>}
              </button>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={() => onDelete(chunk.id)}
          disabled={deleting}
        >
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}

function AddChunkForm({
  businessId,
  onSuccess,
  onCancel,
}: {
  businessId: number;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("document");
  const { toast } = useToast();
  const createChunk = useCreateKnowledgeChunk();

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) return;

    createChunk.mutate(
      { id: businessId, data: { title: title.trim(), content: content.trim(), sourceType } },
      {
        onSuccess: () => {
          toast({ title: "Knowledge added", description: "The bot will now use this context when replying." });
          onSuccess();
        },
        onError: () => {
          toast({ title: "Failed to save", description: "Could not save knowledge chunk.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="border rounded-lg p-4 bg-muted/20 space-y-4">
      <p className="text-sm font-semibold">Add Knowledge</p>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Type</label>
        <div className="flex flex-wrap gap-2">
          {SOURCE_TYPES.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                onClick={() => setSourceType(t.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors",
                  sourceType === t.value ? t.color + " ring-1 ring-offset-1 ring-current" : "bg-background text-muted-foreground border-border hover:bg-muted"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          className="w-full text-sm border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="e.g. Delivery policy, Premium Plan features…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Content <span className="text-red-500">*</span>
        </label>
        <Textarea
          rows={5}
          className="text-sm resize-y"
          placeholder="Paste or type the knowledge content here. The AI will retrieve relevant pieces when answering customer questions."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={10000}
        />
        <p className="text-xs text-muted-foreground text-right">{content.length} / 10,000</p>
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="gap-1.5"
          onClick={handleSubmit}
          disabled={!title.trim() || !content.trim() || createChunk.isPending}
        >
          {createChunk.isPending ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating embedding…</>
          ) : (
            <><Plus className="w-3.5 h-3.5" /> Save</>
          )}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={createChunk.isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function KnowledgeTab({ businessId }: { businessId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: chunks, isLoading } = useListKnowledgeChunks(businessId, {
    query: { enabled: !!businessId, queryKey: getListKnowledgeChunksQueryKey(businessId) },
  });

  const deleteChunk = useDeleteKnowledgeChunk();

  const handleDelete = (chunkId: number) => {
    setDeletingId(chunkId);
    deleteChunk.mutate(
      { id: businessId, chunkId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListKnowledgeChunksQueryKey(businessId) });
          toast({ title: "Deleted", description: "Knowledge chunk removed." });
        },
        onError: () => {
          toast({ title: "Failed to delete", variant: "destructive" });
        },
        onSettled: () => setDeletingId(null),
      }
    );
  };

  const handleAddSuccess = () => {
    queryClient.invalidateQueries({ queryKey: getListKnowledgeChunksQueryKey(businessId) });
    setAdding(false);
  };

  const grouped = (chunks ?? []).reduce<Record<string, KnowledgeChunk[]>>((acc, c) => {
    (acc[c.sourceType] ??= []).push(c);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            Knowledge Base
          </CardTitle>
          <CardDescription className="mt-1">
            Add documents, FAQs, product details, and policies. The bot automatically retrieves the most relevant context before every reply.
          </CardDescription>
        </div>
        {!adding && (
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setAdding(true)}>
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {adding && (
          <AddChunkForm
            businessId={businessId}
            onSuccess={handleAddSuccess}
            onCancel={() => setAdding(false)}
          />
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : !chunks || chunks.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <p className="font-medium text-sm">No knowledge added yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Add documents, FAQs, product info, or policies. The bot will use vector search to find the most relevant context for each customer message.
            </p>
            {!adding && (
              <Button size="sm" variant="outline" className="gap-1.5 mt-1" onClick={() => setAdding(true)}>
                <Plus className="w-3.5 h-3.5" /> Add first entry
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {SOURCE_TYPES.filter((t) => grouped[t.value]?.length).map((t) => (
              <div key={t.value} className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}s · {grouped[t.value].length}
                </p>
                {grouped[t.value].map((chunk) => (
                  <ChunkCard
                    key={chunk.id}
                    chunk={chunk}
                    onDelete={handleDelete}
                    deleting={deletingId === chunk.id}
                  />
                ))}
              </div>
            ))}
            <p className="text-xs text-muted-foreground text-center pt-2">
              {chunks.length} {chunks.length === 1 ? "entry" : "entries"} · Top 3 most relevant chunks retrieved per message
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
