// Server-authoritative run validation. The client submits a RunTrack; the server
// runs this before deriving metrics or minting any reward.

import { BALANCE } from './config/balance.js';
import { haversine, pathLengthMeters } from './geo.js';
import type { RunTrack, RunValidation } from './types.js';

export interface ValidateOptions {
  /** How many times this runner has already forged from this courseHash. */
  priorRepeats?: number;
}

export function validateRun(track: RunTrack, opts: ValidateOptions = {}): RunValidation {
  const reasons: string[] = [];
  const pts = track.points ?? [];
  const cfg = BALANCE.run;

  if (pts.length < 2) {
    return { ok: false, reasons: ['too_few_points'], repeatIndex: opts.priorRepeats ?? 0 };
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

  // Per-segment teleport / vehicle detection.
  let teleports = 0;
  let vehicleLikeSegments = 0;
  for (let i = 1; i < pts.length; i++) {
    const dt = (pts[i]!.t - pts[i - 1]!.t) / 1000;
    if (dt <= 0) {
      reasons.push('non_monotonic_time');
      continue;
    }
    const dm = haversine(pts[i - 1]!, pts[i]!);
    const speed = dm / dt;
    if (speed > cfg.maxPlausibleSpeedMps * 2) teleports++;
    else if (speed > cfg.maxPlausibleSpeedMps) vehicleLikeSegments++;
  }
  if (teleports > 0) reasons.push('gps_jump');
  // If a large share of the track is above running speed, call it a vehicle.
  if (vehicleLikeSegments / pts.length > 0.15) reasons.push('vehicle_suspected');

  return {
    ok: reasons.length === 0,
    reasons,
    repeatIndex: opts.priorRepeats ?? 0,
  };
}
