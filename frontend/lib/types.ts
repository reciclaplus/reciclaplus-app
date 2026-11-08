/** Shared API types for the frontend. */

import type { Role } from "@/lib/roles";

export interface ActiveUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  created_at: string;
}

export interface Neighborhood {
  id: string;
  name: string;
}

export interface Community {
  id: string;
  name: string;
  neighborhoods: Neighborhood[];
}

export interface TownSummary {
  id: string;
  name: string;
  map_center_lat: number;
  map_center_lng: number;
  map_zoom: number;
  archived_at: string | null;
}

export interface TownDetail extends TownSummary {
  categories: string[];
  plastic_types: string[];
  report_partner_text: string | null;
  communities: Community[];
}

/** A town the current user can access, with their role there (from /auth/me). */
export interface UserTown {
  id: string;
  name: string;
  role: Role;
}

export interface Pdr {
  id: string;
  internal_id: number;
  name: string;
  description: string | null;
  community: string;
  neighborhood: string;
  category: string;
  lat: number;
  lng: number;
  created_at: string;
  town_id: string | null;
  neighborhood_id: string | null;
  community_id: string | null;
}

export interface WeekStatus {
  year: number;
  week: number;
  status: "collected" | "empty" | "unavailable" | "closed" | null;
}

export interface PdrWithHistory extends Pdr {
  recent_collections: WeekStatus[];
}
