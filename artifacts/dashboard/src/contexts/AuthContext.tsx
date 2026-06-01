import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthChange } from "@/lib/firebase";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import type { User } from "firebase/auth";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
