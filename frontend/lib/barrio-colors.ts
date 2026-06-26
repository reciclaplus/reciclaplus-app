const PALETTE = [
  "#E53935",
  "#1E88E5",
  "#43A047",
  "#FB8C00",
  "#8E24AA",
  "#00ACC1",
  "#F4511E",
  "#3949AB",
  "#C0CA33",
  "#D81B60",
  "#5E35B1",
  "#00897B",
  "#FFB300",
  "#6D4C41",
  "#546E7A",
];

export function buildBarrioColorMap(
  neighborhoods: string[],
): Map<string, string> {
  const sorted = Array.from(new Set(neighborhoods)).sort();
  const map = new Map<string, string>();
  sorted.forEach((n, i) => map.set(n, PALETTE[i % PALETTE.length]));
  return map;
}

export function getBarrioColor(
  barrioColorMap: Map<string, string>,
  barrio: string,
): string {
  return barrioColorMap.get(barrio) ?? "#757575";
}
