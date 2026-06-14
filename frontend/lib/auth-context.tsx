"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/api";
import type { Role } from "@/lib/roles";

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  error: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  error: false,
});

/**
 * Fetches the current user from /auth/me once and provides it to the tree.
 * Wraps authenticated pages (see app/(authed)/layout.tsx).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: false,
  });

  useEffect(() => {
    let active = true;
    apiFetch<CurrentUser>("/auth/me")
      .then((user) => active && setState({ user, loading: false, error: false }))
      .catch(() => active && setState({ user: null, loading: false, error: true }));
    return () => {
      active = false;
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
