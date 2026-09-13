/**
 * Shared dashboard data shapes, chart color palettes, and label helpers.
 * Used by both the live Dashboard page and the monthly report generator.
 */

export interface NeighborhoodCount {
  neighborhood: string;
  count: number;
}
export interface CommunityCount {
  community: string;
  count: number;
}
export interface CategoryCount {
  category: string;
  count: number;
}
export interface WeekCollections {
  year: number;
  week: number;
  collected: number;
  empty: number;
  unavailable: number;
  closed: number;
  total: number;
}
export interface WeekNeighborhoodCollections {
  year: number;
  week: number;
  neighborhood: string;
  collected: number;
}
export interface StatusBreakdown {
  status: string;
  count: number;
}
export interface MonthWeight {
  year: number;
  month: number;
  plastic_type: string;
  weight_lbs: number;
}
export interface DashboardStats {
  total_pdrs: number;
  pdrs_by_neighborhood: NeighborhoodCount[];
  pdrs_by_community: CommunityCount[];
  pdrs_by_category: CategoryCount[];
  collections_by_week: WeekCollections[];
  collections_by_week_by_neighborhood: WeekNeighborhoodCollections[];
  current_status_breakdown: StatusBreakdown[];
  weight_by_month: MonthWeight[];
}

export const NEIGHBORHOOD_COLORS = [
  "#0d4e31", // forest green
  "#f5951f", // amber accent
  "#1f7a72", // teal
  "#c1440e", // terracotta
  "#5a9c77", // sage
  "#b9740b", // deep gold
  "#3c6e8f", // slate blue
  "#8a3324", // rust
  "#7a9c4f", // olive
];

export const PLASTIC_TYPE_COLORS: Record<string, string> = {
  pet: "#12633f",
  hdpe: "#f5951f",
  pp: "#3c6e8f",
  trash: "#8a3324",
};

export const MONTH_ABBR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function weekLabel(year: number, week: number): string {
  return `S${week}'${String(year).slice(-2)}`;
}

export function monthLabel(year: number, month: number): string {
  return `${MONTH_ABBR[month - 1]}'${String(year).slice(-2)}`;
}

/** Full month name + year, e.g. "Julio 2026" (Intl-derived, same approach as formatWeekLabel in lib/week.ts). */
export function monthTitleLabel(year: number, month: number): string {
  const name = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("es-DO", { month: "long", timeZone: "UTC" });
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}
