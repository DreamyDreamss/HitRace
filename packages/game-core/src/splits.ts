// Per-kilometre splits — the table every runner looks at first after a run.
// Pure geometry + time; no I/O. Interpolates across the sample that crosses each
// kilometre mark so a 1 km split is exactly 1 km, not "the sample nearest 1 km".

import { haversine } from './geo.js';
import type { GpsPoint } from './types.js';

export interface Split {
  /** 1-based kilometre index. The last one may be partial. */
  km: number;
  /** Distance actually covered in this split (km) — 1.0 except for the tail. */
  distanceKm: number;
  durationSec: number;
  /** Pace normalised to a full kilometre, so partial tails stay comparable. */
  paceSecPerKm: number;
  elevationGainM: number;
}

/**
 * Split a track into per-kilometre segments.
 * Returns [] for tracks shorter than 100 m (nothing meaningful to show).
 */
export function computeSplits(points: GpsPoint[]): Split[] {
  if (points.length < 2) return [];

  const splits: Split[] = [];
  let segMeters = 0;
  let segStartT = points[0]!.t;
  let segGain = 0;

  const push = (meters: number, endT: number) => {
    const durationSec = Math.max(0, (endT - segStartT) / 1000);
    const distanceKm = meters / 1000;
    splits.push({
      km: splits.length + 1,
      distanceKm: round(distanceKm, 3),
      durationSec: Math.round(durationSec),
      paceSecPerKm: distanceKm > 0 ? Math.round(durationSec / distanceKm) : 0,
      elevationGainM: Math.round(segGain),
    });
    segStartT = endT;
    segGain = 0;
  };

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    let legMeters = haversine(a, b);
    const legMs = b.t - a.t;
    if (a.ele != null && b.ele != null && b.ele > a.ele) segGain += b.ele - a.ele;

    // A single sample can span more than one kilometre mark (sparse GPS): keep cutting.
    while (segMeters + legMeters >= 1000) {
      const need = 1000 - segMeters;
      const frac = legMeters > 0 ? need / legMeters : 1;
      push(1000, a.t + legMs * frac);
      segMeters = 0;
      legMeters -= need;
    }
    segMeters += legMeters;
  }

  // Tail: only worth showing once it's a real fragment, not GPS noise.
  if (segMeters >= 100) push(segMeters, points[points.length - 1]!.t);
  return splits;
}

/** Fastest full kilometre in the run — the number people brag about. */
export function bestKmPace(splits: Split[]): number | undefined {
  const full = splits.filter((s) => s.distanceKm >= 0.999 && s.paceSecPerKm > 0);
  if (!full.length) return undefined;
  return Math.min(...full.map((s) => s.paceSecPerKm));
}

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
