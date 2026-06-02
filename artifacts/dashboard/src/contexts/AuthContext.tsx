import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthChange } from "@/lib/firebase";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import type { User } from "firebase/auth";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

// ── Dev bypass ─────────────────────────────────────────────────────────────
// When VITE_FIREBASE_API_KEY is not set, Firebase is unavailable on the
// frontend. We inject a fake dev user so ProtectedRoute passes and the full
// app is accessible. The API server also bypasses token verification in this
// mode (see auth-middleware.ts). To enable real auth, add VITE_FIREBASE_API_KEY
// to your secrets and set FIREBASE_SERVICE_ACCOUNT_JSON on the server.
const FIREBASE_CONFIGURED = !!(import.meta.env.VITE_FIREBASE_API_KEY as string | undefined);

const DEV_USER = {
  uid: "dev-bypass",
  displayName: "Dev User",
  email: "dev@localhost",
  photoURL: null,
} as unknown as User;
// ──────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(FIREBASE_CONFIGURED ? null : DEV_USER);
  const [loading, setLoading] = useState(FIREBASE_CONFIGURED);

  useEffect(() => {
    if (!FIREBASE_CONFIGURED) {
      return;
    }
    const unsub = onAuthChange((u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        setAuthTokenGetter(() => u.getIdToken());
      } else {
        setAuthTokenGetter(null);
      }
    });
    return unsub;
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
