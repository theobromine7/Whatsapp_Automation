import { Link, useLocation } from "wouter";
import {
  MessageSquare,
  LayoutDashboard,
  Building2,
  PlusCircle,
  LogOut,
  Settings,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { logout } from "@/lib/firebase";
import { useQueryClient } from "@tanstack/react-query";

const NAV = [
  { href: "/inbox", icon: MessageSquare, label: "Wapp" },
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/businesses", icon: Building2, label: "Businesses" },
  { href: "/businesses/new", icon: PlusCircle, label: "Add" },
  { href: "/pricing", icon: Crown, label: "Pricing" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    try {
      await logout();
      queryClient.clear();
      setLocation("/login");
    } catch {
      // ignore
    }
  };

  const isActive = (href: string) => {
    if (href === "/inbox") return location === "/inbox" || location === "/";
    if (href === "/businesses") return location === "/businesses" || (location.startsWith("/businesses/") && location !== "/businesses/new");
    return location.startsWith(href);
  };

  const initials = user?.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Desktop icon sidebar — hidden on mobile */}
      <aside className="hidden md:flex w-[68px] shrink-0 bg-[#1f2c34] flex-col items-center py-3 gap-1 z-20">
        {/* Logo */}
        <div className="w-12 h-12 mb-4 shrink-0">
          <img src="/logo.png" alt="Wapp" className="w-full h-full object-contain" />
        </div>

        <div className="flex-1 flex flex-col items-center gap-1 w-full px-2">
          {NAV.map(({ href, icon: Icon, label }) => (
            <Tooltip key={href} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link href={href}>
                  <div
                    className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer transition-all select-none",
                      isActive(href)
                        ? "bg-primary text-white"
                        : "text-[#8696a0] hover:bg-[#2a3942] hover:text-[#d1d7db]"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium text-xs">
                {label}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* User avatar + logout */}
        <div className="flex flex-col items-center gap-2 mt-2">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={handleSignOut}
                className="w-9 h-9 rounded-full bg-[#2a3942] border border-[#3a4a54] flex items-center justify-center text-[#8696a0] hover:bg-red-900/40 hover:text-red-400 hover:border-red-800 transition-all shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium text-xs">
              Sign out
            </TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="avatar" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <span className="text-primary text-xs font-bold">{initials}</span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium text-xs">
              {user?.displayName ?? user?.email ?? "Account"}
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden pb-[60px] md:pb-0">
        {children}
      </div>

      {/* Mobile bottom nav bar — Dashboard & Pricing hidden here, accessible via Settings */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#1f2c34] flex items-center justify-around px-1 pt-2 pb-[max(8px,env(safe-area-inset-bottom))]">
        {NAV.filter(({ href }) => href !== "/dashboard" && href !== "/pricing").map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href}>
            <div className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all",
              isActive(href) ? "text-white" : "text-[#8696a0]"
            )}>
              <Icon className={cn("w-5 h-5", isActive(href) && "text-primary")} />
              <span className={cn("text-[10px] font-medium", isActive(href) ? "text-primary" : "text-[#8696a0]")}>
                {label}
              </span>
            </div>
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** Wrap non-inbox pages with padding + scrollable content */
export function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full mx-auto p-4 md:p-8 max-w-5xl overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
