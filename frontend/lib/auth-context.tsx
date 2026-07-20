"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/roles";

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

/**
 * - `loading`: still resolving the session / user.
 * - `authenticated`: signed in and provisioned in `users` (`user` is set).
 * - `unprovisioned`: has a valid Supabase session but no `users` row — the
 *   backend rejects `/auth/me` (403). Must NOT be treated as logged out, or
 *   the landing page bounces them back into the app (infinite loop).
 * - `unauthenticated`: no Supabase session at all.
 */
export type AuthStatus =
  | "loading"
  | "authenticated"
  | "unprovisioned"
  | "unauthenticated";

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  status: AuthStatus;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  status: "loading",
});

/**
 * Fetches the current user from /auth/me once and provides it to the tree.
 * Wraps authenticated pages (see app/(authed)/layout.tsx).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    status: "loading",
  });

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (!session) {
        setState({ user: null, loading: false, status: "unauthenticated" });
        return;
      }
      apiFetch<CurrentUser>("/auth/me")
        .then(
          (user) =>
            active && setState({ user, loading: false, status: "authenticated" }),
        )
        .catch(
          () =>
            active &&
            setState({ user: null, loading: false, status: "unprovisioned" }),
        );
    });
    return () => {
      active = false;
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
