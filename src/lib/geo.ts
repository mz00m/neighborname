/** 1000 feet in meters */
export const RADIUS_METERS = 305;

/** Max properties to keep in a neighborhood */
export const MAX_PROPERTIES = 100;

/** Haversine distance in meters between two lat/lng points */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Filter and cap a list of geocoded items by proximity to a center point.
 * Returns the closest items within RADIUS_METERS, capped at MAX_PROPERTIES.
 */
export function filterByProximity<T>(
  items: T[],
  getCoords: (item: T) => [number, number] | undefined,
  centerLat: number,
  centerLng: number
): T[] {
  const withDistance = items
    .map((item) => {
      const coords = getCoords(item);
      if (!coords) return null;
      const dist = distanceMeters(centerLat, centerLng, coords[0], coords[1]);
      return { item, dist };
    })
    .filter((x): x is { item: T; dist: number } => x !== null)
    .filter((x) => x.dist <= RADIUS_METERS)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, MAX_PROPERTIES);

  return withDistance.map((x) => x.item);
}
