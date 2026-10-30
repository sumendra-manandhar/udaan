import type { Airport, TrackPoint } from '../db/types';

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface RingCheck {
  inside: Airport | null;
  nearest: { airport: Airport; distanceM: number } | null;
  airportsKnown: number;
}

/** Check a point against the airport rings stored on the device. Runs offline. */
export function checkAirportRings(lat: number, lng: number, airports: Airport[]): RingCheck {
  let nearest: RingCheck['nearest'] = null;
  let inside: Airport | null = null;
  for (const a of airports) {
    if (a.deleted_at) continue;
    const d = distanceM(lat, lng, a.lat, a.lng);
    if (!nearest || d < nearest.distanceM) nearest = { airport: a, distanceM: d };
    if (d <= a.radius_m && !inside) inside = a;
  }
  return { inside, nearest, airportsKnown: airports.length };
}

/** Nepal's rough bounding box; spots outside it are rejected by the database. */
export const NEPAL_BOUNDS: [[number, number], [number, number]] = [
  [80.0, 26.3],
  [88.3, 30.5],
];

export function inNepal(lat: number, lng: number): boolean {
  return lat >= 26 && lat <= 31 && lng >= 80 && lng <= 89;
}

/** Polygon approximating a circle, for drawing rings on the map. */
export function circlePolygon(lat: number, lng: number, radiusM: number, steps = 64): [number, number][] {
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * 2 * Math.PI;
    const dLat = (radiusM / R) * Math.cos(bearing);
    const dLng = ((radiusM / R) * Math.sin(bearing)) / Math.cos(rad(lat));
    coords.push([lng + (dLng * 180) / Math.PI, lat + (dLat * 180) / Math.PI]);
  }
  return coords;
}

export function trackDistanceM(track: TrackPoint[]): number {
  let d = 0;
  for (let i = 1; i < track.length; i++) {
    d += distanceM(track[i - 1][1], track[i - 1][0], track[i][1], track[i][0]);
  }
  return d;
}

/** Slippy-map tile coordinates covering a bounding box at zoom z. */
export function tilesForBounds(west: number, south: number, east: number, north: number, z: number): [number, number, number][] {
  const n = 2 ** z;
  const x = (lng: number) => Math.floor(((lng + 180) / 360) * n);
  const y = (lat: number) => {
    const r = rad(lat);
    return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  };
  const out: [number, number, number][] = [];
  for (let tx = x(west); tx <= x(east); tx++) {
    for (let ty = y(north); ty <= y(south); ty++) out.push([z, tx, ty]);
  }
  return out;
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}
