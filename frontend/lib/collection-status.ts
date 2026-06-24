export type Status = "collected" | "empty" | "unavailable" | "closed";

export const STATUSES: Status[] = ["collected", "empty", "unavailable", "closed"];

export const STATUS_COLORS: Record<Status, string> = {
  collected: "#2e7d32",
  empty: "#ed6c02",
  unavailable: "#d32f2f",
  closed: "#616161",
};
