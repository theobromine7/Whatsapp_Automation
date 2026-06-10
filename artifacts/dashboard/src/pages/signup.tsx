import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signUpWithEmail } from "@/lib/firebase";

export default function Signup() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await signUpWithEmail(email, password, name.trim() || undefined);
      setLocation("/inbox");
    } catch (err: unknown) {
      setError(friendlyError((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-2">
          <img src="/logo.png" alt="Wapp" className="w-24 h-24 object-contain" />
          <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="text-sm text-muted-foreground text-center">
            Already on Advize.store? Use the same email — your store syncs automatically.
          </p>
        </div>

        <div className="bg-background border rounded-xl p-6 shadow-sm space-y-4">
          {/* Email form */}
          <form onSubmit={handleSignup} className="space-y-3">
            <div>
              <label className="text-xs font-medium block mb-1">Business name <span className="text-muted-foreground">(optional)</span></label>
              <input
                type="text"
                autoComplete="organization"
                placeholder="My Awesome Store"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
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
                autoComplete="new-password"
                placeholder="Min. 6 characters"
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
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Create account
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center">
            By signing up you agree to our terms of service.
          </p>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Sign in
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
  if (msg.includes("email-already-in-use"))
    return "An account with this email already exists. Try signing in instead.";
  if (msg.includes("invalid-email")) return "Please enter a valid email address.";
  if (msg.includes("weak-password")) return "Password is too weak. Use at least 6 characters.";
  if (msg.includes("network-request-failed")) return "Network error. Check your connection and try again.";
  if (msg.includes("VITE_FIREBASE_API_KEY")) return "Authentication is not configured yet.";
  return "Sign-up failed. Please try again.";
}
