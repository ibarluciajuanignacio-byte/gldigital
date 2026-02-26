import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, setAuthToken } from "../api/client";

type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "reseller";
  resellerId?: string;
};

type AuthContextValue = {
  user: User | null;
  token: string | null;
  hydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "gldigital_auth";

function readStoredAuth(): { token: string; user: User } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { token?: string; user?: User };
    if (!data?.token || !data?.user) return null;
    return { token: data.token, user: data.user };
  } catch {
    return null;
  }
}

const DEFAULT_USER: User = {
  id: "local",
  email: "admin@gldigital.local",
  name: "Admin",
  role: "admin"
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = readStoredAuth();
  const [user, setUser] = useState<User | null>(stored?.user ?? DEFAULT_USER);
  const [token, setToken] = useState<string | null>(stored?.token ?? null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const next = readStoredAuth();
      if (next?.token) {
        setAuthToken(next.token);
      } else {
        setUser(DEFAULT_USER);
        setAuthToken(undefined);
      }
      if (!next) localStorage.removeItem(STORAGE_KEY);
    } catch {
      setUser(DEFAULT_USER);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    } finally {
      setHydrated(true);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      hydrated,
      login: async (email, password) => {
        const { data } = await api.post("/auth/login", { email, password });
        setToken(data.token);
        setUser(data.user);
        setAuthToken(data.token);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: data.token, user: data.user }));
        } catch (error) {
          console.warn("No se pudo guardar sesión local.", error);
        }
      },
      logout: () => {
        setToken(null);
        setUser(null);
        // Importante: no cambiamos hydrated. Solo limpiamos sesión.
        setAuthToken(undefined);
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (storageError) {
          console.warn("No se pudo borrar sesión local.", storageError);
        }
      }
    }),
    [token, user, hydrated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
