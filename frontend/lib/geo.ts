/**
 * Geographic helpers for proximity calculations.
 *
 * Pure functions with no React or Google Maps dependency, so they can be
 * reasoned about and unit-tested in isolation.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance between two points, in metres (haversine formula).
 *
 * Accurate to well under a metre at the distances this app cares about
 * (tens to hundreds of metres), which is far below GPS error anyway.
 */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

interface NearestOptions<T> {
  /** A candidate must come within this radius to be picked up. */
  enterRadiusM: number;
  /**
   * Once picked up, a candidate is kept until it drifts beyond this (larger)
   * radius. The gap between the two radii is hysteresis: without it, GPS jitter
   * around the enter radius makes the result flicker on and off.
   */
  exitRadiusM: number;
  /** Result of the previous call, so hysteresis can be applied. */
  previousId: string | null;
  idOf: (item: T) => string;
}

export interface NearestResult<T> {
  item: T;
  distanceM: number;
}

/**
 * Nearest candidate to `pos`, or null if nothing is close enough.
 *
 * Resolution order:
 *   1. Anything within `enterRadiusM` — the nearest one wins, so walking past
 *      one point towards another switches the result as you'd expect.
 *   2. Otherwise the previous result, as long as it is still within
 *      `exitRadiusM` (hysteresis — see above).
 *   3. Otherwise null.
 */
export function nearestWithinRadius<T extends LatLng>(
  candidates: T[],
  pos: LatLng,
  { enterRadiusM, exitRadiusM, previousId, idOf }: NearestOptions<T>,
): NearestResult<T> | null {
  let nearest: NearestResult<T> | null = null;
  let previous: NearestResult<T> | null = null;

  for (const item of candidates) {
    const distanceM = distanceMeters(pos, item);

    if (nearest === null || distanceM < nearest.distanceM) {
      nearest = { item, distanceM };
    }
    if (previousId !== null && idOf(item) === previousId) {
      previous = { item, distanceM };
    }
  }

  if (nearest !== null && nearest.distanceM <= enterRadiusM) return nearest;
  if (previous !== null && previous.distanceM <= exitRadiusM) return previous;
  return null;
}

/**
 * Distance as a short Spanish label, e.g. "45 m" or "1,2 km".
 *
 * Metres are rounded to the nearest 5 so the reading doesn't imply precision
 * a phone GPS does not have (and doesn't jitter by single metres on screen).
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 5) * 5} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}
