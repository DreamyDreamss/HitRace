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
  segmentMeters,
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
    finishingPower: computeFinishingPower(pts),
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

/**
 * How much the runner had left at the end, 0..1, with **0.5 meaning an evenly-paced run**.
 *
 * This is what the magic stat is made of. It replaced heart-rate zone time, which no phone can
 * measure without a watch — the app was inventing the samples, so every sword got the same
 * magic and the stat meant nothing.
 *
 * Two parts, both from GPS and the clock alone:
 * - **Split**: second half's pace against the first half's. Most runners fade; holding pace is
 *   already good, and finishing faster is the discipline this stat is about.
 * - **Closing surge**: the last kilometre against the run's own average.
 *
 * Deliberately a *ratio*, never an absolute speed — absolute speed is already sharpness. And the
 * obvious exploit (jog the first half to manufacture a split) pays for itself: it drags the
 * average pace down, which is exactly what sharpness and the pace bonus are scored on.
 */
function computeFinishingPower(pts: GpsPoint[]): number {
  const EVEN = 0.5;
  const halves = halfPaces(pts);
  if (!halves) return EVEN;

  // A 12% faster second half is about as good as it gets over a normal training run.
  const splitScore = balanced((halves.first - halves.second) / halves.first, 0.12);

  const closing = closingPace(pts);
  if (closing == null) return splitScore;
  const avgPace = closing.totalSec / (closing.totalM / 1000);
  const surgeScore = balanced((avgPace - closing.pace) / avgPace, 0.15);
  return clamp(splitScore * 0.6 + surgeScore * 0.4, 0, 1);
}

/** Maps a signed ratio to 0..1 with 0 landing on 0.5 — "even" is the middle, not the bottom. */
function balanced(delta: number, span: number): number {
  return (clamp(delta / span, -1, 1) + 1) / 2;
}

/** Average pace (sec/km) of each half of the run, split at the halfway point **in time**. */
function halfPaces(pts: GpsPoint[]): { first: number; second: number } | null {
  if (pts.length < 6) return null;
  const start = pts[0]!.t;
  const total = pts[pts.length - 1]!.t - start;
  if (total <= 0) return null;

  let cut = pts.findIndex((p) => p.t - start >= total / 2);
  if (cut < 1 || cut >= pts.length - 1) cut = Math.floor(pts.length / 2);

  const first = pts.slice(0, cut + 1);
  const second = pts.slice(cut);
  const d1 = pathLengthMeters(first);
  const d2 = pathLengthMeters(second);
  // Too little ground in either half and the ratio is noise, not pacing.
  if (d1 < 200 || d2 < 200) return null;
  const s1 = (first[first.length - 1]!.t - first[0]!.t) / 1000;
  const s2 = (second[second.length - 1]!.t - second[0]!.t) / 1000;
  if (s1 <= 0 || s2 <= 0) return null;
  return { first: s1 / (d1 / 1000), second: s2 / (d2 / 1000) };
}

/** Pace over the closing stretch — the last kilometre, or the last quarter of a shorter run. */
function closingPace(pts: GpsPoint[]): { pace: number; totalM: number; totalSec: number } | null {
  const totalM = pathLengthMeters(pts);
  const totalSec = (pts[pts.length - 1]!.t - pts[0]!.t) / 1000;
  if (totalM < 800 || totalSec <= 0) return null;
  const stretch = Math.min(1000, totalM * 0.25);

  let covered = 0;
  let i = pts.length - 1;
  for (; i > 0 && covered < stretch; i--) covered += segmentMeters(pts[i - 1]!, pts[i]!);
  if (covered < 200) return null;
  const sec = (pts[pts.length - 1]!.t - pts[i]!.t) / 1000;
  if (sec <= 0) return null;
  return { pace: sec / (covered / 1000), totalM, totalSec };
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

  // Magic ← finishing power: what the runner had left at the end. An evenly-paced run sits at
  // the midpoint, fading drops below it, finishing strong climbs above. Measurable on any phone,
  // and it drives the combat special gauge — the reserve you saved is the reserve you unleash.
  const magic = Math.round(
    clamp(
      s.magic.floor + m.finishingPower * s.magic.maxFromFinish,
      s.magic.floor,
      s.magic.floor + s.magic.maxFromFinish,
    ),
  );

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
