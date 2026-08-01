// 각성 — the growth axis that boss drops pay for.

import { BALANCE } from '../config/balance.js';
import type { Stats } from '../types.js';

export interface AwakenCost {
  manaStone: number;
  ore: number;
  /** Fractional stat bonus at this stage (cumulative, not per-stage). */
  statBonus: number;
}

/** Cost and effect of moving from [currentStage] to the next. Null when already maxed. */
export function awakenCost(currentStage: number): AwakenCost | null {
  const stages = BALANCE.awakening.stages;
  const next = Math.max(0, Math.floor(currentStage));
  return next >= stages.length ? null : (stages[next] as AwakenCost);
}

export function maxAwakenStage(): number {
  return BALANCE.awakening.maxStage;
}

/** Total stat multiplier granted by having reached [stage]. */
export function awakenBonus(stage: number): number {
  const stages = BALANCE.awakening.stages;
  const s = Math.max(0, Math.min(Math.floor(stage), stages.length));
  return s === 0 ? 0 : (stages[s - 1]!.statBonus ?? 0);
}

/**
 * Awakening applied to a sword's stats.
 *
 * Deliberately deterministic — it never fails. Upgrading is the gamble in this game (it can send
 * a blade backwards); awakening is the reward for having shown up to enough boss fights. Making
 * both of them dice rolls would leave nothing that simply pays off.
 */
export function applyAwakening(stats: Stats, stage: number): Stats {
  const bonus = awakenBonus(stage);
  if (bonus <= 0) return stats;
  const scale = 1 + bonus;
  return {
    sharpness: Math.round(stats.sharpness * scale),
    weight: Math.round(stats.weight * scale),
    durability: Math.round(stats.durability * scale),
    magic: Math.round(stats.magic * scale),
  };
}
