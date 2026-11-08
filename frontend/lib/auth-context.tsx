"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import type { UserTown } from "@/lib/types";

/** The signed-in user. Roles are per town: see `towns` and lib/town-context.tsx. */
export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  is_superadmin: boolean;
  towns: UserTown[];
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

interface AuthContextValue extends AuthState {
  /** Reload the user, e.g. after their towns change (a town created, archived
   * or renamed). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  status: "loading",
  refresh: async () => {},
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

  const refresh = useCallback(async () => {
    try {
      const user = await apiFetch<CurrentUser>("/auth/me");
      setState({ user, loading: false, status: "authenticated" });
    } catch {
      // Keep the current state: a failed refresh shouldn't sign anyone out.
    }
  }, []);

  const value = useMemo(() => ({ ...state, refresh }), [state, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
