// Server-authoritative run validation. The client submits a RunTrack; the server
// runs this before deriving metrics or minting any reward.

import { BALANCE } from './config/balance.js';
import { haversine, pathLengthMeters } from './geo.js';
import type { GpsPoint, RunTrack, RunValidation } from './types.js';

export interface ValidateOptions {
  /** How many times this runner has already forged from this courseHash. */
  priorRepeats?: number;
}

export interface SanitizeResult {
  track: RunTrack;
  /** Points discarded as sensor noise. */
  dropped: number;
  /** Longest unbroken stretch of discarded points. */
  longestDropRun: number;
}

/**
 * Phone GPS lies. A cold fix, a tunnel, a reflection off a building — any of these can put one
 * sample a kilometre away and back, and treating that as proof of cheating throws away a real
 * run the person actually ran. So isolated outliers are *dropped* here and the run continues on
 * the points that survive.
 *
 * Cheating still doesn't get through, because a faked track can't produce isolated outliers:
 * every point after a real teleport is measured against the last **accepted** point, so a track
 * that genuinely moves impossibly fast keeps failing and shows up as a long run of drops or a
 * large dropped share — both of which `validateRun` rejects.
 */
export function sanitizeTrack(track: RunTrack): SanitizeResult {
  const pts = track.points ?? [];
  const ceiling = BALANCE.run.maxPlausibleSpeedMps * 2;
  if (pts.length < 2) return { track, dropped: 0, longestDropRun: 0 };

  const keep: number[] = [0];
  let last = pts[0]!;
  let dropped = 0;
  let currentRun = 0;
  let longestDropRun = 0;

  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!;
    // dt accumulates across dropped points, so a runner who really covered the ground while
    // the receiver was confused is not punished for the gap.
    const dt = (p.t - last.t) / 1000;
    const implausible = dt > 0 && haversine(last, p) / dt > ceiling;
    if (implausible) {
      dropped++;
      currentRun++;
      longestDropRun = Math.max(longestDropRun, currentRun);
      continue;
    }
    currentRun = 0;
    keep.push(i);
    last = p;
  }

  if (dropped === 0) return { track, dropped: 0, longestDropRun: 0 };

  // cadence/heartRate are index-aligned with points, so they have to lose the same indices.
  const pick = <T>(arr: T[] | undefined) =>
    arr && arr.length === pts.length ? keep.map((i) => arr[i]!) : arr;

  return {
    track: {
      ...track,
      points: keep.map((i) => pts[i]!) as GpsPoint[],
      cadence: pick(track.cadence),
      heartRate: pick(track.heartRate),
    },
    dropped,
    longestDropRun,
  };
}

export function validateRun(track: RunTrack, opts: ValidateOptions = {}): RunValidation {
  const reasons: string[] = [];
  const cfg = BALANCE.run;
  const raw = track.points ?? [];

  if (raw.length < 2) {
    return { ok: false, reasons: ['too_few_points'], repeatIndex: opts.priorRepeats ?? 0, track };
  }

  const clean = sanitizeTrack(track);
  const pts = clean.track.points;

  // A stray fix or two is noise; a sustained one is a fabricated track. Three consecutive
  // impossible samples is well past anything a real receiver produces.
  if (clean.longestDropRun >= 3 || clean.dropped / raw.length > 0.15) reasons.push('gps_jump');
  if (pts.length < 2) {
    return { ok: false, reasons: ['gps_jump'], repeatIndex: opts.priorRepeats ?? 0, track: clean.track };
  }

  const distanceM = pathLengthMeters(pts);
  const durationSec = (pts[pts.length - 1]!.t - pts[0]!.t) / 1000;

  if (distanceM < cfg.minDistanceKm * 1000) reasons.push('below_min_distance');
  if (durationSec < cfg.minDurationSec) reasons.push('below_min_duration');

  // Overall pace ceiling (too fast overall ⇒ not on foot).
  const paceSecPerKm = durationSec / (distanceM / 1000);
  if (distanceM > 0 && paceSecPerKm < cfg.minPlausiblePaceSecPerKm) {
    reasons.push('pace_too_fast');
  }

  // Per-segment vehicle detection, on the surviving points.
  let vehicleLikeSegments = 0;
  for (let i = 1; i < pts.length; i++) {
    const dt = (pts[i]!.t - pts[i - 1]!.t) / 1000;
    if (dt <= 0) {
      reasons.push('non_monotonic_time');
      continue;
    }
    if (haversine(pts[i - 1]!, pts[i]!) / dt > cfg.maxPlausibleSpeedMps) vehicleLikeSegments++;
  }
  // If a large share of the track is above running speed, call it a vehicle.
  if (vehicleLikeSegments / pts.length > 0.15) reasons.push('vehicle_suspected');

  return {
    ok: reasons.length === 0,
    reasons: [...new Set(reasons)],
    repeatIndex: opts.priorRepeats ?? 0,
    track: clean.track,
  };
}
