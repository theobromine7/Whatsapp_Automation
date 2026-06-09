import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { logout } from "@/lib/firebase";
import { customFetch } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  User,
  LogOut,
  Trash2,
  ShieldCheck,
  FileText,
  AlertTriangle,
  ChevronRight,
  Mail,
  LayoutDashboard,
  Crown,
  RefreshCw,
  Zap,
  Gift,
  XCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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

interface SubStatus {
  plan: string;
  status: string;
  subscriptionId?: string;
  currentPeriodEnd?: string;
}

const PLAN_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  free:    { label: "Free",    color: "text-emerald-600", icon: Gift    },
  starter: { label: "Starter", color: "text-blue-600",    icon: Zap     },
  pro:     { label: "Pro",     color: "text-[#00a884]",   icon: Crown   },
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  active:        { label: "Active",        className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  authenticated: { label: "Activating…",  className: "bg-blue-50 text-blue-700 border-blue-200"         },
  created:       { label: "Pending",       className: "bg-yellow-50 text-yellow-700 border-yellow-200"   },
  halted:        { label: "Payment Failed",className: "bg-red-50 text-red-700 border-red-200"            },
  cancelled:     { label: "Cancelled",     className: "bg-gray-50 text-gray-600 border-gray-200"         },
  completed:     { label: "Completed",     className: "bg-gray-50 text-gray-600 border-gray-200"         },
  none:          { label: "No Plan",       className: "bg-gray-50 text-gray-500 border-gray-200"         },
};

export default function Settings() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [cancellingPlan, setCancellingPlan] = useState(false);

  const { data: subStatus, isLoading: subLoading, refetch: refetchSub } = useQuery<SubStatus>({
    queryKey: ["subscription-status"],
    queryFn: () => customFetch<SubStatus>("/api/payments/subscriptions/status"),
  });

  const handleCancelPlan = async () => {
    setCancellingPlan(true);
    try {
      await customFetch("/api/payments/subscriptions", { method: "DELETE" });
      toast({ title: "Subscription cancelled", description: "Your plan will remain active until the end of the billing period." });
      refetchSub();
    } catch (err) {
      toast({ title: "Cancellation failed", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setCancellingPlan(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      queryClient.clear();
      setLocation("/login");
    } catch {
      toast({ title: "Sign out failed", description: "Please try again.", variant: "destructive" });
      setSigningOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await customFetch("/api/account", { method: "DELETE" });
      await logout();
      queryClient.clear();
      setLocation("/login");
      toast({ title: "Account deleted", description: "Your account and all data have been removed." });
    } catch {
      toast({ title: "Delete failed", description: "Could not delete account. Please contact support.", variant: "destructive" });
      setDeletingAccount(false);
    }
  };

  const initials = user?.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="avatar" className="w-14 h-14 rounded-full object-cover" />
              ) : (
                <span className="text-primary text-lg font-bold">{initials}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{user?.displayName ?? "—"}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground truncate">{user?.email ?? "—"}</p>
              </div>
              {user?.emailVerified && (
                <Badge variant="outline" className="text-[10px] mt-1.5 border-green-300 text-green-700 bg-green-50 gap-1">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  Verified
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-primary" />
            Billing &amp; Plan
          </CardTitle>
          <CardDescription>Your current AutoPay subscription</CardDescription>
        </CardHeader>
        <CardContent>
          {subLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : (() => {
            const plan = subStatus?.plan ?? "free";
            const status = subStatus?.status ?? "none";
            const planInfo = PLAN_LABELS[plan] ?? PLAN_LABELS["free"]!;
            const statusBadge = STATUS_BADGES[status] ?? STATUS_BADGES["none"]!;
            const PlanIcon = planInfo.icon;
            const isActive = status === "active" || status === "authenticated";
            const isPaid = plan !== "free" && status !== "none";
            const periodEnd = subStatus?.currentPeriodEnd
              ? new Date(subStatus.currentPeriodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
              : null;

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <PlanIcon className={`w-5 h-5 ${planInfo.color}`} />
                    <span className="font-semibold text-sm">{planInfo.label} Plan</span>
                  </div>
                  <Badge variant="outline" className={`text-xs ${statusBadge.className}`}>
                    {statusBadge.label}
                  </Badge>
                </div>

                {periodEnd && (
                  <p className="text-xs text-muted-foreground">
                    Next billing date: <span className="font-medium">{periodEnd}</span>
                  </p>
                )}

                <div className="flex gap-2 flex-wrap">
                  {plan === "free" || status === "none" || status === "cancelled" || status === "completed" ? (
                    <Button size="sm" className="gap-1.5 bg-[#00a884] hover:bg-[#008f71] text-white border-0" onClick={() => setLocation("/pricing")}>
                      <Crown className="w-3.5 h-3.5" /> Upgrade Plan
                    </Button>
                  ) : null}

                  {isPaid && isActive && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50" disabled={cancellingPlan}>
                          {cancellingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                          Cancel Plan
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Your AutoPay mandate will be cancelled and you won't be charged next month. You'll keep access to the {planInfo.label} plan until the end of this billing period.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep Plan</AlertDialogCancel>
                          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleCancelPlan}>
                            Yes, cancel
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* More — mobile-only shortcut to nav items hidden from bottom bar */}
      <Card className="md:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-primary" />
            More
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Link href="/dashboard">
            <div className="flex items-center justify-between px-6 py-3.5 hover:bg-muted/50 cursor-pointer transition-colors border-b">
              <div className="flex items-center gap-3">
                <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium">Dashboard</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </Link>
          <Link href="/pricing">
            <div className="flex items-center justify-between px-6 py-3.5 hover:bg-muted/50 cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <Crown className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium">Pricing &amp; Plans</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </Link>
        </CardContent>
      </Card>

      {/* Legal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Legal
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Link href="/terms">
            <div className="flex items-center justify-between px-6 py-3.5 hover:bg-muted/50 cursor-pointer transition-colors border-b">
              <div>
                <p className="text-sm font-medium">Terms and Conditions</p>
                <p className="text-xs text-muted-foreground">Last updated June 2026</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </Link>
          <Link href="/privacy">
            <div className="flex items-center justify-between px-6 py-3.5 hover:bg-muted/50 cursor-pointer transition-colors">
              <div>
                <p className="text-sm font-medium">Privacy Policy</p>
                <p className="text-xs text-muted-foreground">Last updated June 2026</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </Link>
        </CardContent>
      </Card>

      {/* Sign out */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <LogOut className="w-4 h-4 text-primary" />
            Session
          </CardTitle>
          <CardDescription>Sign out of your account on this device</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            <LogOut className="w-4 h-4" />
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-red-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-4 h-4" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated businesses, conversations, and data. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2" disabled={deletingAccount}>
                <Trash2 className="w-4 h-4" />
                Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your account, all businesses, conversations, messages, and contacts. There is no way to recover this data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                >
                  {deletingAccount ? "Deleting…" : "Yes, delete everything"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
