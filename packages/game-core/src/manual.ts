// No-GPS / treadmill mode. Indoor runners enter distance + pace; we synthesise a
// procedural (seeded) track so the forge pipeline is identical, but the result is
// flagged procedural, capped below LEGEND, and never earns the "real route" codex mark.

import { BALANCE } from './config/balance.js';
import { computeCP, computeForgeScore, deriveMetrics, deriveShape, deriveStats, rarityFromScore } from './conversion.js';
import { Rng } from './rng.js';
import type { ForgeScore, GpsPoint, RunTrack, Sword } from './types.js';

/** Build a procedural track (a plausible wandering path) from manual inputs. */
export function generateProceduralTrack(distanceKm: number, paceSecPerKm: number, seed: number | string): RunTrack {
  const rng = new Rng(seed);
  const n = Math.max(24, Math.round(distanceKm * 30));
  const totalSec = distanceKm * paceSecPerKm;
  const startTs = 1_700_000_000_000;

  // Wander in a local plane, then map to lat/lng near a fixed origin. Purely cosmetic shape.
  const origin = { lat: 37.5, lng: 127.0 };
  const cos0 = Math.cos((origin.lat * Math.PI) / 180);
  const points: GpsPoint[] = [];
  const cadence: number[] = [];
  let x = 0, y = 0, ang = rng.float(0, Math.PI * 2);
  const stepM = (distanceKm * 1000) / n;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    ang += rng.float(-0.6, 0.6);
    x += Math.cos(ang) * stepM;
    y += Math.sin(ang) * stepM;
    points.push({
      lat: origin.lat + y / 111320,
      lng: origin.lng + x / (111320 * cos0),
      ele: 20, // flat — treadmill
      t: startTs + Math.round(f * totalSec * 1000),
    });
    cadence.push(168 + rng.float(-2, 2)); // steady indoor cadence
  }
  return { points, cadence, heartRate: points.map(() => 150), maxHeartRate: 190 };
}

export interface ManualForgeContext {
  ownerId: string;
  runId: string;
  swordId: string;
  createdAt: number;
  repeatIndex: number;
  seed: number | string;
  name?: string;
}

/** Forge a sword from manual inputs (treadmill mode), with the LEGEND cap applied. */
export function forgeManual(distanceKm: number, paceSecPerKm: number, ctx: ManualForgeContext): { sword: Sword; score: ForgeScore } {
  const track = generateProceduralTrack(distanceKm, paceSecPerKm, ctx.seed);
  const metrics = deriveMetrics(track);
  const rawScore = computeForgeScore(metrics, { repeatIndex: ctx.repeatIndex, isNewCourse: ctx.repeatIndex === 0 });

  // Cap below LEGEND to preserve the prestige of GPS runs.
  const cappedTotal = Math.min(rawScore.total, BALANCE.run.manualScoreCeiling);
  const score: ForgeScore = { ...rawScore, total: cappedTotal, rarity: rarityFromScore(cappedTotal) };

  const stats = deriveStats(metrics);
  const shape = { ...deriveShape(track, metrics), procedural: true, trueDoubleEdge: false };
  const slots = score.rarity === 'SR' ? 2 : score.rarity === 'R' ? 1 : 0;

  const sword: Sword = {
    id: ctx.swordId,
    ownerId: ctx.ownerId,
    name: ctx.name ?? '실내 단련검',
    rarity: score.rarity,
    stats,
    shape,
    plus: 0,
    cp: computeCP(stats),
    engravings: Array.from({ length: slots }, () => null),
    runId: ctx.runId,
    courseHash: `treadmill:${Math.round(distanceKm)}`, // bucketed so repeats decay
    createdAt: ctx.createdAt,
  };
  return { sword, score };
}
