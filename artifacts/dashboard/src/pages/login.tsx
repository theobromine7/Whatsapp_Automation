import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { MessageCircle, Loader2, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loginWithEmail, logout } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

export default function Login() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const redirectTo = new URLSearchParams(search).get("from") ?? "/inbox";
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      setLocation(redirectTo);
    } catch (err: unknown) {
      setError(friendlyError((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await logout();
      queryClient.clear();
    } catch {
      // ignore
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) {
    const displayName = user.displayName ?? user.email ?? "there";
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8 gap-2">
            <img src="/logo.png" alt="Wapp" className="w-24 h-24 object-contain" />
            <h1 className="text-2xl font-bold tracking-tight">You're signed in</h1>
            <p className="text-sm text-muted-foreground text-center">
              Hi {displayName}! Where would you like to go?
            </p>
          </div>
          <div className="bg-background border rounded-xl p-6 shadow-sm space-y-3">
            <Button className="w-full gap-2" onClick={() => setLocation("/inbox")}>
              <MessageCircle className="w-4 h-4" />
              Open Chat
            </Button>
            <Button variant="outline" className="w-full gap-2" onClick={() => setLocation("/dashboard")}>
              Go to Dashboard
            </Button>
            <div className="relative pt-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs text-muted-foreground">
                <span className="bg-background px-2">or</span>
              </div>
            </div>
            <Button variant="ghost" className="w-full gap-2 text-muted-foreground hover:text-red-600 hover:bg-red-50" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-2">
          <img src="/logo.png" alt="Wapp" className="w-24 h-24 object-contain" />
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground text-center">
            Sign in to your Wapp account
          </p>
        </div>

        <div className="bg-background border rounded-xl p-6 shadow-sm space-y-4">
          {/* Email form */}
          <form onSubmit={handleEmail} className="space-y-3">
            <div>
              <label className="text-xs font-medium block mb-1">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Password</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-5">
          New to Wapp?{" "}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            Create an account
          </Link>
        </p>
        <p className="text-center mt-2">
          <Link href="/" className="text-xs text-muted-foreground hover:underline">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}

function friendlyError(msg: string): string {
  if (msg.includes("invalid-credential") || msg.includes("wrong-password") || msg.includes("user-not-found"))
    return "Incorrect email or password. Please try again.";
  if (msg.includes("invalid-email")) return "Please enter a valid email address.";
  if (msg.includes("too-many-requests")) return "Too many attempts. Please wait a moment and try again.";
  if (msg.includes("network-request-failed")) return "Network error. Check your connection and try again.";
  if (msg.includes("VITE_FIREBASE_API_KEY")) return "Authentication is not configured yet.";
  return "Sign-in failed. Please try again.";
}
