/** Shared API types for the frontend. */

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
