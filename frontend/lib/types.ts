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
}

export interface TownDetail extends TownSummary {
  categories: string[];
  communities: Community[];
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
}
