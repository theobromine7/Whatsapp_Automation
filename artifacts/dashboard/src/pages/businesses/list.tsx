import { Link } from "wouter";
import {
  useListBusinesses,
  getListBusinessesQueryKey,
} from "@workspace/api-client-react";
import {
  Plus,
  Building2,
  Wifi,
  WifiOff,
  ChevronRight,
  Smartphone,
  Power,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function connectionLabel(b: { connectionType: string; sessionStatus?: string | null; whatsappPhoneNumberId?: string | null }) {
  if (b.connectionType === "qr_session" && b.sessionStatus === "connected") return { label: "QR Connected", ok: true };
  if (b.connectionType === "meta_cloud" && b.whatsappPhoneNumberId) return { label: "Meta API", ok: true };
  return { label: "Not Connected", ok: false };
}

export default function BusinessList() {
  const { data: businesses, isLoading } = useListBusinesses({
    query: { queryKey: getListBusinessesQueryKey() },
  });

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header bar */}
      <div className="h-[60px] bg-[#f0f2f5] border-b border-[#e9edef] px-6 flex items-center justify-between shrink-0">
        <h1 className="font-semibold text-[#111b21] text-base">Businesses</h1>
        <Link href="/businesses/new">
          <Button size="sm" className="h-8 gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" /> Add Business
          </Button>
        </Link>
      </div>

      <div className="p-6 max-w-3xl mx-auto space-y-3">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))
        ) : !Array.isArray(businesses) || businesses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-[#f0f2f5] flex items-center justify-center">
              <Building2 className="w-7 h-7 text-[#c4c4c4]" />
            </div>
            <div>
              <p className="font-medium text-[#111b21]">No businesses yet</p>
              <p className="text-sm text-[#667781] mt-1">Add a business to connect WhatsApp and start automation.</p>
            </div>
            <Link href="/businesses/new">
              <Button size="sm" className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add your first business
              </Button>
            </Link>
          </div>
        ) : (
          businesses.map((biz) => {
            const conn = connectionLabel(biz);
            const phone = biz.connectedPhone ? `+${biz.connectedPhone}` : biz.whatsappPhoneNumber;
            return (
              <Link key={biz.id} href={`/businesses/${biz.id}`}>
                <div className="bg-white border border-[#e9edef] rounded-xl px-5 py-4 flex items-center gap-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-[#111b21]">{biz.name}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] h-4 px-1.5",
                          biz.isActive
                            ? "border-green-200 text-green-700 bg-green-50"
                            : "border-gray-200 text-gray-500 bg-gray-50"
                        )}
                      >
                        {biz.isActive ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#667781]">
                      <span>{biz.businessType}</span>
                      {phone && <span className="font-mono">{phone}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className={cn("flex items-center gap-1 text-xs", conn.ok ? "text-green-600" : "text-[#8696a0]")}>
                      {conn.ok ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                      <span>{conn.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#c4c4c4] group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
