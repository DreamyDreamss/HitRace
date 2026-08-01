// The heart of the game: turn a validated run into a sword.
//   SHAPE  ← GPS geometry
//   STATS  ← running metrics
//   SCORE  ← achievement composition → RARITY
// Deterministic given the same track (+ context), so client and server agree.

import { BALANCE } from './config/balance.js';
import {
  countSelfIntersections,
  courseHash,
  curviness as curvinessOf,
  decimate,
  elevationGain,
  haversine,
  normalize,
  pathLengthMeters,
  smooth,
  toLocalXY,
} from './geo.js';
import type {
  BladeShape,
  BladeStyle,
  ForgeScore,
  GpsPoint,
  Rarity,
  RunMetrics,
  RunTrack,
  Stats,
} from './types.js';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);

// ── Metrics ──────────────────────────────────────────────────────────────────

export function deriveMetrics(track: RunTrack): RunMetrics {
  const pts = track.points;
  const distanceM = pathLengthMeters(pts);
  const distanceKm = distanceM / 1000;
  const durationSec = (pts[pts.length - 1]!.t - pts[0]!.t) / 1000;
  const avgPaceSecPerKm = distanceKm > 0 ? durationSec / distanceKm : Infinity;
  const elevationGainM = elevationGain(pts);

  const avgCadence = mean(track.cadence ?? []);
  const cadenceStability = cv(track.cadence ?? []); // 0 = perfectly steady

  const hrZoneFraction = computeHrZoneFraction(track);

  const startEnd = haversine(pts[0]!, pts[pts.length - 1]!);
  const isRoundTrip = startEnd <= BALANCE.run.loopClosureMeters;

  const xy = smooth(normalize(toLocalXY(pts)), 1);
  const dec = decimate(xy, 120);
  const c = curvinessOf(dec);
  const intersections = countSelfIntersections(dec);
  const enclosed = enclosedArea(dec);
  const isClosedLoop = isRoundTrip && enclosed > 0.05; // returns to start AND wraps area

  return {
    distanceKm,
    durationSec,
    avgPaceSecPerKm,
    elevationGainM,
    avgCadence,
    cadenceStability,
    hrZoneFraction,
    hasHeartRate: (track.heartRate ?? []).length > 0,
    hasCadence: avgCadence > 0,
    isRoundTrip,
    isClosedLoop,
    curviness: c,
    intersections,
    negativeSplit: computeNegativeSplit(pts),
  };
}

function computeHrZoneFraction(track: RunTrack): number {
  const hr = track.heartRate ?? [];
  if (hr.length === 0) return 0;
  const max = track.maxHeartRate ?? 190;
  // Target zone = 70–90% of max HR.
  const lo = max * 0.7;
  const hi = max * 0.9;
  const inZone = hr.filter((v) => v >= lo && v <= hi).length;
  return inZone / hr.length;
}

function computeNegativeSplit(pts: GpsPoint[]): boolean {
  if (pts.length < 4) return false;
  const mid = Math.floor(pts.length / 2);
  const firstDist = pathLengthMeters(pts.slice(0, mid + 1));
  const secondDist = pathLengthMeters(pts.slice(mid));
  const firstTime = (pts[mid]!.t - pts[0]!.t) / 1000;
  const secondTime = (pts[pts.length - 1]!.t - pts[mid]!.t) / 1000;
  if (firstDist === 0 || secondDist === 0 || firstTime === 0 || secondTime === 0) return false;
  const firstPace = firstTime / (firstDist / 1000);
  const secondPace = secondTime / (secondDist / 1000);
  return secondPace < firstPace; // faster (lower pace) in 2nd half
}

// ── Stats ────────────────────────────────────────────────────────────────────

export function deriveStats(m: RunMetrics): Stats {
  const s = BALANCE.stats;

  // Sharpness ← pace (faster pace = higher). Invert & map.
  const paceT =
    (s.sharpness.maxPaceSecPerKm - clamp(m.avgPaceSecPerKm, s.sharpness.minPaceSecPerKm, s.sharpness.maxPaceSecPerKm)) /
    (s.sharpness.maxPaceSecPerKm - s.sharpness.minPaceSecPerKm);
  const sharpness = Math.round(lerp(s.sharpness.min, s.sharpness.max, paceT));

  // Weight ← elevation gain.
  const weight = Math.round(clamp(s.weight.floor + m.elevationGainM * s.weight.perElevationM, s.weight.floor, s.weight.cap));

  // Durability ← cadence stability (lower CV = higher durability). If no cadence data, mid value.
  const durability =
    m.avgCadence > 0
      ? Math.round(clamp(s.durability.base - m.cadenceStability * s.durability.stabilityPenaltyPerCv, s.durability.floor, s.durability.base))
      : Math.round((s.durability.base + s.durability.floor) / 2);

  // Magic ← HR-zone fraction. Without a heart-rate source (which is most phones) this is not
  // "zero time in zone", it is "unknown" — so it takes the midpoint, the same way durability
  // does when there is no cadence. Scoring absence as zero would quietly make every sword
  // forged without a watch weaker than every sword forged before this was measured honestly.
  const magic = m.hasHeartRate
    ? Math.round(clamp(s.magic.floor + m.hrZoneFraction * s.magic.maxFromZone, s.magic.floor, s.magic.floor + s.magic.maxFromZone))
    : Math.round(s.magic.floor + s.magic.maxFromZone / 2);

  return { sharpness, weight, durability, magic };
}

// ── Score & rarity ───────────────────────────────────────────────────────────

export function computeForgeScore(m: RunMetrics, ctx: { repeatIndex: number; isNewCourse: boolean }): ForgeScore {
  const sc = BALANCE.score;

  const base = Math.round(lerp(0, sc.baseMax, m.distanceKm / sc.baseDistanceKmForMax));
  const paceBonus = m.avgPaceSecPerKm <= sc.paceBonusThresholdSecPerKm ? sc.paceBonus : 0;
  const explorationBonus = ctx.isNewCourse ? sc.explorationBonus : 0;
  const negativeSplitBonus = m.negativeSplit ? sc.negativeSplitBonus : 0;
  const elevationBonus = Math.min(sc.elevationBonusCap, Math.floor(m.elevationGainM / 100) * sc.elevationBonusPer100m);

  const raw = base + paceBonus + explorationBonus + negativeSplitBonus + elevationBonus;

  // Repeat decay multiplier (applied to the *whole* score).
  const stepsOver = Math.max(0, ctx.repeatIndex - BALANCE.run.repeatDecayFromIndex);
  const decayMult = Math.pow(1 - BALANCE.run.repeatDecayPerStep, stepsOver);
  const total = Math.round(raw * decayMult);
  const repeatPenalty = total - raw;

  return {
    total,
    breakdown: { base, paceBonus, explorationBonus, negativeSplitBonus, elevationBonus, repeatPenalty },
    rarity: rarityFromScore(total),
  };
}

export function rarityFromScore(score: number): Rarity {
  const r = BALANCE.rarity;
  if (score >= r.LEGEND) return 'LEGEND';
  if (score >= r.SR) return 'SR';
  if (score >= r.R) return 'R';
  return 'N';
}

// ── Shape ────────────────────────────────────────────────────────────────────

export function deriveShape(track: RunTrack, m: RunMetrics): BladeShape {
  const xy = normalize(smooth(toLocalXY(track.points), 2));
  const centerline = decimate(xy, 64);

  let style: BladeStyle;
  if (m.isClosedLoop) style = m.curviness > 0.5 ? 'chakram' : 'curved';
  else if (m.isRoundTrip) style = 'double_edge';
  else style = m.curviness > 0.35 ? 'curved' : 'straight';

  const runeAnchors = pickRuneAnchors(centerline, m.intersections);
  const lengthScale = clamp(m.distanceKm * 0.08, 0.08, 1.6);
  const trueDoubleEdge = m.isRoundTrip && !m.isClosedLoop;

  return { style, centerline, lengthScale, runeAnchors, trueDoubleEdge };
}

function pickRuneAnchors(poly: Array<{ x: number; y: number }>, count: number): Array<{ x: number; y: number }> {
  const n = Math.min(count, 5);
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(((i + 1) / (n + 1)) * poly.length);
    if (poly[idx]) out.push(poly[idx]!);
  }
  return out;
}

// ── CP (also used by combat) ─────────────────────────────────────────────────

export function computeCP(stats: Stats): number {
  const c = BALANCE.combat.cp;
  return Math.round(stats.sharpness * c.sharpness + stats.weight * c.weight + stats.durability * c.durability + stats.magic * c.magic);
}

// ── Course id ────────────────────────────────────────────────────────────────
export function fingerprint(track: RunTrack): string {
  return courseHash(track.points);
}

// ── Small numeric helpers ────────────────────────────────────────────────────
function mean(a: number[]): number {
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
}
function cv(a: number[]): number {
  if (a.length < 2) return 0;
  const m = mean(a);
  if (m === 0) return 0;
  const variance = a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length;
  return Math.sqrt(variance) / m;
}

/** Shoelace area of the normalised polygon (0..~1). */
function enclosedArea(poly: Array<{ x: number; y: number }>): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}
