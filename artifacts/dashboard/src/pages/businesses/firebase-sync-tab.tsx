import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw, CheckCircle2, AlertCircle, LogIn, LogOut,
  Store, Package, Loader2, ShoppingBag,
} from "lucide-react";
import { auth, loginWithGoogle, loginWithEmail, logout, onAuthChange } from "@/lib/firebase";
import { customFetch } from "@workspace/api-client-react";
import type { User } from "firebase/auth";
import { format } from "date-fns";

interface SyncStatus {
  firebaseUid: string | null;
  upiId: string | null;
  storeSlug: string | null;
  storeName: string | null;
  lastSyncedAt: string | null;
  syncedProductCount: number;
}

interface FirebaseSyncTabProps {
  businessId: number;
}

export function FirebaseSyncTab({ businessId }: FirebaseSyncTabProps) {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loginMode, setLoginMode] = useState<"google" | "email">("google");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // Firebase not configured
  const firebaseReady = auth !== null;

  useEffect(() => {
    const unsub = onAuthChange(setUser);
    return unsub;
  }, []);

  useEffect(() => {
    loadSyncStatus();
  }, [businessId]);

  async function loadSyncStatus() {
    setLoadingStatus(true);
    try {
      const data = await customFetch<SyncStatus>(`/api/businesses/${businessId}/firebase-sync`);
      if (data) setSyncStatus(data);
    } catch { /* ignore */ } finally {
      setLoadingStatus(false);
    }
  }

  async function handleGoogleLogin() {
    setLoggingIn(true);
    try {
      await loginWithGoogle();
      toast({ title: "Signed in", description: "Connected to your Advize account." });
    } catch (err: unknown) {
      toast({ title: "Sign-in failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    try {
      await loginWithEmail(email, password);
      toast({ title: "Signed in", description: "Connected to your Advize account." });
    } catch (err: unknown) {
      toast({ title: "Sign-in failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleSync() {
    if (!user) return;
    setSyncing(true);
    try {
      const data = await customFetch<{ productssynced: number; store?: { name: string } }>(`/api/businesses/${businessId}/firebase-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firebaseUid: user.uid }),
      });
      toast({
        title: "Store synced!",
        description: `${data.productssynced} products imported from "${data.store?.name}".`,
      });
      loadSyncStatus();
    } catch (err: unknown) {
      toast({ title: "Sync failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  async function handleLogout() {
    await logout();
    toast({ title: "Signed out" });
  }

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Firebase API key not configured
  if (!firebaseReady) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertCircle className="w-8 h-8 text-amber-500" />
          <p className="font-medium">Firebase not configured</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Set the <code className="bg-muted px-1 rounded text-xs">VITE_FIREBASE_API_KEY</code> environment variable to enable Advize store sync.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Auth card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="w-4 h-4 text-primary" />
            Advize Store Connection
          </CardTitle>
          <CardDescription>
            Log in with the same account you use on Advize to pull your store's products into the AI bot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!user ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={loginMode === "google" ? "default" : "outline"}
                  onClick={() => setLoginMode("google")}
                >Google</Button>
                <Button
                  size="sm"
                  variant={loginMode === "email" ? "default" : "outline"}
                  onClick={() => setLoginMode("email")}
                >Email</Button>
              </div>

              {loginMode === "google" ? (
                <Button onClick={handleGoogleLogin} disabled={loggingIn} className="w-full gap-2">
                  {loggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  Sign in with Google
                </Button>
              ) : (
                <form onSubmit={handleEmailLogin} className="space-y-3">
                  <input
                    type="email"
                    required
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full text-sm border rounded px-3 py-2 bg-background"
                  />
                  <input
                    type="password"
                    required
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full text-sm border rounded px-3 py-2 bg-background"
                  />
                  <Button type="submit" disabled={loggingIn} className="w-full gap-2">
                    {loggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                    Sign in
                  </Button>
                </form>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-900">{user.displayName ?? user.email}</p>
                  <p className="text-xs text-green-700 font-mono">{user.uid.slice(0, 16)}…</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-muted-foreground gap-1" onClick={handleLogout}>
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              Product Catalog Sync
            </CardTitle>
            {syncStatus?.lastSyncedAt && (
              <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50 gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Synced {format(new Date(syncStatus.lastSyncedAt), "MMM d, h:mm a")}
              </Badge>
            )}
          </div>
          <CardDescription>
            Imports your Advize store products into the bot's knowledge base so it can answer product questions and share links.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {syncStatus?.storeName && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-muted/40 rounded-lg border">
                <p className="text-xs text-muted-foreground mb-0.5">Store</p>
                <p className="font-medium text-sm">{syncStatus.storeName}</p>
                {syncStatus.storeSlug && (
                  <a
                    href={`https://store.advize.in/store/${syncStatus.storeSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline"
                  >
                    store.advize.in/store/{syncStatus.storeSlug}
                  </a>
                )}
              </div>
              <div className="p-3 bg-muted/40 rounded-lg border">
                <p className="text-xs text-muted-foreground mb-0.5">Products synced</p>
                <p className="font-bold text-2xl text-primary font-mono">{syncStatus.syncedProductCount}</p>
              </div>
              {syncStatus.upiId && (
                <div className="p-3 bg-muted/40 rounded-lg border col-span-2">
                  <p className="text-xs text-muted-foreground mb-0.5">UPI Payment ID</p>
                  <p className="font-mono text-sm">{syncStatus.upiId}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Bot will auto-send a payment QR when customers ask to buy
                  </p>
                </div>
              )}
            </div>
          )}

          {!syncStatus?.storeName && !user && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <ShoppingBag className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Sign in above to connect your Advize store</p>
            </div>
          )}

          {!syncStatus?.storeName && user && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0" />
              No store linked yet. Click Sync to import your products.
            </div>
          )}

          <Button
            onClick={handleSync}
            disabled={!user || syncing}
            className="w-full gap-2"
          >
            {syncing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Syncing products…</>
            ) : (
              <><RefreshCw className="w-4 h-4" /> {syncStatus?.lastSyncedAt ? "Re-sync Store" : "Sync Store Now"}</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
