import { strings } from "@/lib/strings";

const KNOWN_LABELS: Record<string, string> = strings.weights.plasticTypes;

/**
 * Display label for a plastic type. Each town sets its own list, so a type may
 * have no translated label (a custom type); then the stored value is shown.
 */
export function plasticTypeLabel(type: string): string {
  return KNOWN_LABELS[type] ?? type;
}
