import { Link } from "wouter";
import {
  useGetDashboardStats,
  getGetDashboardStatsQueryKey,
  useListBusinesses,
  getListBusinessesQueryKey,
} from "@workspace/api-client-react";
import {
  MessageSquare,
  Users,
  Building2,
  Activity,
  Plus,
  ArrowRight,
  Zap,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white border border-[#e9edef] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-[#667781]">{label}</span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", color)}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <div className="text-2xl font-bold text-[#111b21] font-mono">{value}</div>
      {sub && <p className="text-xs text-[#8696a0] mt-1">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey() },
  });

  const { data: businesses, isLoading: bizLoading } = useListBusinesses({
    query: { queryKey: getListBusinessesQueryKey() },
  });

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="h-[60px] bg-[#f0f2f5] border-b border-[#e9edef] px-4 md:px-6 flex items-center justify-between">
        <h1 className="font-semibold text-[#111b21] text-base">Dashboard</h1>
        <Link href="/businesses/new">
          <Button size="sm" className="h-8 gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" /> Add Business
          </Button>
        </Link>
      </div>

      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5 md:space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statsLoading ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : stats ? (
            <>
              <StatCard icon={Building2} label="Businesses" value={`${stats.activeBusinesses}/${stats.totalBusinesses}`} sub="active / total" color="bg-blue-500" />
              <StatCard icon={Users} label="Conversations" value={stats.totalConversations} sub={`+${stats.conversationsToday} today`} color="bg-violet-500" />
              <StatCard icon={MessageSquare} label="Messages" value={stats.totalMessages} sub={`+${stats.messagesToday} today`} color="bg-primary" />
              <StatCard icon={Activity} label="Uptime" value="100%" sub="All systems running" color="bg-emerald-500" />
            </>
          ) : null}
        </div>

        {/* Business list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[#111b21]">Your Businesses</h2>
            <Link href="/businesses">
              <span className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          </div>

          {bizLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : !businesses || businesses.length === 0 ? (
            <div className="bg-white border border-dashed border-[#e9edef] rounded-xl p-8 flex flex-col items-center gap-3 text-center">
              <Zap className="w-8 h-8 text-primary/40" />
              <div>
                <p className="font-medium text-[#111b21] text-sm">No businesses yet</p>
                <p className="text-xs text-[#667781] mt-1">Connect a WhatsApp number to deploy your AI sales agent.</p>
              </div>
              <Link href="/businesses/new">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs mt-1">
                  <Plus className="w-3.5 h-3.5" /> Get started
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {businesses.slice(0, 5).map((biz) => {
                const isConnected =
                  (biz.connectionType === "qr_session" && biz.sessionStatus === "connected") ||
                  (biz.connectionType === "meta_cloud" && !!biz.whatsappPhoneNumberId);
                return (
                  <Link key={biz.id} href={`/businesses/${biz.id}`}>
                    <div className="bg-white border border-[#e9edef] rounded-xl px-4 py-3 flex items-center gap-3 hover:border-primary/40 transition-colors cursor-pointer group">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#111b21] text-sm truncate">{biz.name}</p>
                        <p className="text-xs text-[#667781] truncate">{biz.businessType}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-green-400" : "bg-gray-300")} />
                        <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5", biz.isActive ? "border-green-200 text-green-700" : "border-gray-200 text-gray-500")}>
                          {biz.isActive ? "Active" : "Paused"}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-[#c4c4c4] group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
