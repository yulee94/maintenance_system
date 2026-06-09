import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { getMe, login as loginRequest, logout as logoutRequest } from "./client";
import type { AuthUser } from "./types";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (loginId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const current = await getMe().catch(() => null);
    setUser(current);
  };

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (loginId, password) => {
        const next = await loginRequest(loginId, password);
        setUser(next);
      },
      logout: async () => {
        await logoutRequest();
        setUser(null);
      },
      refresh
    }),
    [loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider.");
  return value;
}
