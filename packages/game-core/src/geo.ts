// GPS geometry helpers: distance, smoothing, shape classification, curvature.
// Pure functions over GpsPoint[]. No external deps.

import type { GpsPoint } from './types.js';

const EARTH_R = 6371000; // metres

/** Great-circle distance between two lat/lng points in metres. */
export function haversine(a: GpsPoint, b: GpsPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

/** Total path length in metres. */
export function pathLengthMeters(pts: GpsPoint[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += haversine(pts[i - 1]!, pts[i]!);
  return d;
}

/** Cumulative positive elevation gain in metres (ignores descents). */
export function elevationGain(pts: GpsPoint[]): number {
  let gain = 0;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!.ele;
    const cur = pts[i]!.ele;
    if (prev != null && cur != null && cur > prev) gain += cur - prev;
  }
  return gain;
}

/**
 * Project lat/lng to a local planar XY (metres) using an equirectangular
 * approximation centred on the track. Good enough for shapes up to city scale.
 */
export function toLocalXY(pts: GpsPoint[]): Array<{ x: number; y: number }> {
  if (pts.length === 0) return [];
  const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const cos0 = Math.cos(toRad(lat0));
  const lng0 = pts[0]!.lng;
  const latRef = pts[0]!.lat;
  return pts.map((p) => ({
    x: toRad(p.lng - lng0) * EARTH_R * cos0,
    y: toRad(p.lat - latRef) * EARTH_R,
  }));
}

/** Chaikin corner-cutting smoothing, `iterations` passes. Keeps endpoints. */
export function smooth(
  poly: Array<{ x: number; y: number }>,
  iterations = 2,
): Array<{ x: number; y: number }> {
  let out = poly;
  for (let it = 0; it < iterations; it++) {
    if (out.length < 3) break;
    const next: Array<{ x: number; y: number }> = [out[0]!];
    for (let i = 0; i < out.length - 1; i++) {
      const p = out[i]!;
      const q = out[i + 1]!;
      next.push({ x: p.x * 0.75 + q.x * 0.25, y: p.y * 0.75 + q.y * 0.25 });
      next.push({ x: p.x * 0.25 + q.x * 0.75, y: p.y * 0.25 + q.y * 0.75 });
    }
    next.push(out[out.length - 1]!);
    out = next;
  }
  return out;
}

/** Normalise a polyline into the unit box [0,1]², preserving aspect ratio. */
export function normalize(
  poly: Array<{ x: number; y: number }>,
): Array<{ x: number; y: number }> {
  if (poly.length === 0) return [];
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  const span = Math.max(spanX, spanY) || 1;
  return poly.map((p) => ({ x: (p.x - minX) / span, y: (p.y - minY) / span }));
}

/**
 * curviness 0..1: 1 − (straight-line span / path length), mapped so a straight
 * out-and-back (which doubles back) still reads as low curviness via span logic.
 */
export function curviness(poly: Array<{ x: number; y: number }>): number {
  if (poly.length < 2) return 0;
  let len = 0;
  for (let i = 1; i < poly.length; i++) {
    len += Math.hypot(poly[i]!.x - poly[i - 1]!.x, poly[i]!.y - poly[i - 1]!.y);
  }
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const span = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (len === 0) return 0;
  return Math.min(1, Math.max(0, 1 - span / len));
}

/** Count segment self-intersections (bounded O(n²); caller should decimate first). */
export function countSelfIntersections(poly: Array<{ x: number; y: number }>): number {
  let count = 0;
  const n = poly.length;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 2; j < n - 1; j++) {
      if (i === 0 && j === n - 2) continue; // shared endpoint on closed loops
      if (segmentsIntersect(poly[i]!, poly[i + 1]!, poly[j]!, poly[j + 1]!)) count++;
    }
  }
  return count;
}

function segmentsIntersect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number },
): boolean {
  const d = (a: typeof p1, b: typeof p1, c: typeof p1) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

/** Decimate a polyline to at most `max` points (uniform stride). */
export function decimate<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const stride = arr.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * stride)]!);
  out.push(arr[arr.length - 1]!);
  return out;
}

/** A stable fingerprint of a course (rounded start/end/centroid + length bucket). */
export function courseHash(pts: GpsPoint[]): string {
  if (pts.length === 0) return 'empty';
  const r = (n: number) => Math.round(n * 1000) / 1000; // ~100m grid
  const start = pts[0]!;
  const end = pts[pts.length - 1]!;
  const cLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const cLng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
  const km = Math.round(pathLengthMeters(pts) / 500); // 0.5km buckets
  return `${r(start.lat)},${r(start.lng)}|${r(end.lat)},${r(end.lng)}|${r(cLat)},${r(cLng)}|${km}`;
}
