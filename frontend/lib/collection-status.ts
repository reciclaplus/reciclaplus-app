export type Status = "collected" | "empty" | "unavailable" | "closed";

export const STATUSES: Status[] = ["collected", "empty", "unavailable", "closed"];

export const STATUS_COLORS: Record<Status, string> = {
  collected: "#0a6238",
  empty: "#f0a020",
  unavailable: "#d6453f",
  closed: "#aab3a8",
};

/** Status pill background + text colors per the emerald design tokens. */
export const STATUS_PILL_COLORS: Record<Status, { bg: string; text: string }> = {
  collected: { bg: "#dff3e3", text: "#1f8a44" },
  empty: { bg: "#fdedd3", text: "#b9740b" },
  unavailable: { bg: "#fbe3e3", text: "#c62828" },
  closed: { bg: "#eef1ec", text: "#7a867b" },
};
