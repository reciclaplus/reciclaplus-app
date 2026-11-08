import type { TownDetail } from "@/lib/types";

export interface NeighborhoodOption {
  id: string;
  name: string;
  communityId: string;
  communityName: string;
  /** The barrio name, plus its community when another community in the town
   * has a barrio with the same name. */
  label: string;
}

/**
 * A town's barrios as select options, sorted by label. Barrios are identified by
 * ID because the same name can exist in two communities.
 */
export function neighborhoodOptions(detail: TownDetail): NeighborhoodOption[] {
  const all = detail.communities.flatMap((c) =>
    c.neighborhoods.map((n) => ({
      id: n.id,
      name: n.name,
      communityId: c.id,
      communityName: c.name,
    })),
  );
  const counts = new Map<string, number>();
  for (const n of all) counts.set(n.name, (counts.get(n.name) ?? 0) + 1);
  return all
    .map((n) => ({
      ...n,
      label: (counts.get(n.name) ?? 0) > 1 ? `${n.name} (${n.communityName})` : n.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

/** Label for a barrio ID, falling back to the given name for unknown IDs. */
export function neighborhoodLabel(
  options: NeighborhoodOption[],
  id: string | null,
  fallback: string,
): string {
  return options.find((o) => o.id === id)?.label ?? fallback;
}
