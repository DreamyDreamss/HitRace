// PvP matchmaking band logic and RP (rank-point) deltas.

import { BALANCE } from './config/balance.js';
import { Rng } from './rng.js';

/** The CP tolerance band widens with wait time, then falls back to a ghost. */
export function matchBand(waitSec: number): { band: number; ghost: boolean } {
  const p = BALANCE.pvp;
  if (waitSec >= p.ghostFallbackAtSec) return { band: p.matchBandWidened, ghost: true };
  if (waitSec >= p.matchBandWidenedAtSec) return { band: p.matchBandWidened, ghost: false };
  return { band: p.matchBandInitial, ghost: false };
}

/** Is `candidateCp` within the current band around `myCp`? */
export function inBand(myCp: number, candidateCp: number, waitSec: number): boolean {
  const { band } = matchBand(waitSec);
  return Math.abs(candidateCp - myCp) <= myCp * band;
}

/** RP change for a match outcome. Seeded so it's reproducible from a match id. */
export function rpDelta(won: boolean, seed: number | string): number {
  const p = BALANCE.pvp.rp;
  const rng = new Rng(seed);
  return won ? rng.int(p.winMin, p.winMax) : -rng.int(p.lossMin, p.lossMax);
}

// Tier ladder.
export const TIERS = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Legend'] as const;
export type Tier = (typeof TIERS)[number];
export const STEPS_PER_TIER = 4;
export const RP_PER_STEP = 100;

export function tierFromRp(rp: number): { tier: Tier; step: number; label: string } {
  const totalSteps = Math.max(0, Math.floor(rp / RP_PER_STEP));
  const tierIdx = Math.min(TIERS.length - 1, Math.floor(totalSteps / STEPS_PER_TIER));
  const step = STEPS_PER_TIER - (totalSteps % STEPS_PER_TIER); // 4..1, matches "B2" style
  const tier = TIERS[tierIdx]!;
  return { tier, step, label: `${tier[0]}${step}` };
}

/** Soft reset at season end: drop by N tiers' worth of RP. */
export function seasonSoftReset(rp: number): number {
  const drop = BALANCE.pvp.seasonSoftResetTiers * STEPS_PER_TIER * RP_PER_STEP;
  return Math.max(0, rp - drop);
}
