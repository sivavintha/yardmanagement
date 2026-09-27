import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client";

export type MenuAction = "view" | "create" | "edit" | "void" | "print" | "export";
export type Permissions = Record<string, Partial<Record<MenuAction, boolean>>>;

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: Permissions;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (menu: string, action: MenuAction) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function login(email: string, password: string) {
    await api.post("/auth/login", { email, password });
    await refresh();
  }

  async function logout() {
    await api.post("/auth/logout");
    setUser(null);
  }

  function can(menu: string, action: MenuAction) {
    return Boolean(user?.permissions?.[menu]?.[action]);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
