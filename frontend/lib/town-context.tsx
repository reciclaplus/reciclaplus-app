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
import { useAuth } from "@/lib/auth-context";
import type { TownDetail, UserTown } from "@/lib/types";

/** Remembers the last town per device. A convenience only: always checked
 * against the user's towns from /auth/me, and safe to lose. */
const STORAGE_KEY = "reciclapp.townId";

function readStoredTownId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeTownId(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the user just picks their town again next time.
  }
}

interface TownState {
  /** Towns the user can access. Empty until /auth/me resolves. */
  towns: UserTown[];
  /** The selected town, or null if none is chosen yet. */
  town: UserTown | null;
  /** The selected town's settings and communities, once loaded. */
  detail: TownDetail | null;
  detailError: boolean;
  selectTown: (id: string) => void;
  /** Return to the picker (for users with several towns). */
  clearTown: () => void;
  /** Reload the selected town's settings, e.g. after editing them. */
  refreshDetail: () => Promise<void>;
  /** Prefix an API path with the selected town's routes: townPath("/pdrs").
   * Stable while the town stays the same, so it's safe in effect dependencies. */
  townPath: (path: string) => string;
}

const TownContext = createContext<TownState | null>(null);

/**
 * Tracks which town the user is working in. A user with one town gets it
 * automatically; with several, the last one used on this device, or none until
 * they pick (PermissionGuard then shows the picker).
 */
export function TownProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const towns = useMemo(() => user?.towns ?? [], [user]);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TownDetail | null>(null);
  const [detailError, setDetailError] = useState(false);

  // The chosen town if still accessible, else the remembered one, else the
  // only one.
  const town = useMemo(() => {
    const byId = (id: string | null) => towns.find((t) => t.id === id) ?? null;
    if (chosenId !== null) return byId(chosenId);
    return byId(readStoredTownId()) ?? (towns.length === 1 ? towns[0] : null);
  }, [towns, chosenId]);

  // For refreshes after the initial load (e.g. after editing the town).
  const loadDetail = useCallback(async (id: string) => {
    try {
      const loaded = await apiFetch<TownDetail>(`/towns/${id}`);
      setDetail(loaded);
      setDetailError(false);
    } catch {
      setDetailError(true);
    }
  }, []);

  useEffect(() => {
    // The previous town's detail stays in state until this resolves, but is
    // never exposed: `value` only returns detail matching the selected town.
    // `active` drops a late response after a switch to another town.
    if (!town) return;
    let active = true;
    apiFetch<TownDetail>(`/towns/${town.id}`)
      .then((loaded) => {
        if (!active) return;
        setDetail(loaded);
        setDetailError(false);
      })
      .catch(() => {
        if (active) setDetailError(true);
      });
    return () => {
      active = false;
    };
  }, [town]);

  const value = useMemo<TownState>(
    () => ({
      towns,
      town,
      detail: detail && town && detail.id === town.id ? detail : null,
      detailError,
      selectTown: (id) => {
        storeTownId(id);
        setChosenId(id);
      },
      clearTown: () => {
        storeTownId(null);
        setChosenId("");
      },
      refreshDetail: async () => {
        if (town) await loadDetail(town.id);
      },
      townPath: (path) => `/towns/${town?.id}${path}`,
    }),
    [towns, town, detail, detailError, loadDetail],
  );

  return <TownContext.Provider value={value}>{children}</TownContext.Provider>;
}

export function useTownState(): TownState {
  const state = useContext(TownContext);
  if (!state) throw new Error("useTownState must be used inside TownProvider");
  return state;
}

export interface CurrentTown {
  town: UserTown;
  detail: TownDetail;
  /** Prefix an API path with the town's routes: townPath("/pdrs"). */
  townPath: (path: string) => string;
  refreshDetail: () => Promise<void>;
}

/**
 * The selected town for a page. Only for components rendered inside
 * PermissionGuard, which waits for a town and its detail before rendering.
 */
export function useTown(): CurrentTown {
  const { town, detail, refreshDetail, townPath } = useTownState();
  if (!town || !detail) {
    throw new Error("useTown must be used inside PermissionGuard");
  }
  return { town, detail, townPath, refreshDetail };
}
