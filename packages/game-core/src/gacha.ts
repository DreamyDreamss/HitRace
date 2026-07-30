// Ore gacha ("주조 광맥"): yields materials / engrave stones / ore — NEVER swords.
// Deterministic given a seed. Pity (천장) guarantees a legend material at pityCount.

import { BALANCE } from './config/balance.js';
import { Rng } from './rng.js';

export type GachaTier = 'legendMaterial' | 'engraveStone' | 'upgradeOre';

export interface GachaPull {
  tier: GachaTier;
  /** True if this pull was forced by hitting the pity counter. */
  pity: boolean;
}

export interface GachaState {
  /** Pulls since the last legend material. Persist this per user. */
  pityCounter: number;
}

/** Resolve one pull, advancing pity. Returns the pull and the next state. */
export function pull(state: GachaState, rng: Rng): { pull: GachaPull; state: GachaState } {
  const g = BALANCE.gacha;
  const nextCount = state.pityCounter + 1;

  if (nextCount >= g.pityCount) {
    return { pull: { tier: 'legendMaterial', pity: true }, state: { pityCounter: 0 } };
  }

  const roll = rng.next();
  let tier: GachaTier;
  if (roll < g.rates.legendMaterial) tier = 'legendMaterial';
  else if (roll < g.rates.legendMaterial + g.rates.engraveStone) tier = 'engraveStone';
  else tier = 'upgradeOre';

  const newPity = tier === 'legendMaterial' ? 0 : nextCount;
  return { pull: { tier, pity: false }, state: { pityCounter: newPity } };
}

/** Resolve a 10-pull. Uses a single seeded rng so the sequence is reproducible. */
export function pullMany(state: GachaState, count: number, rng: Rng): { pulls: GachaPull[]; state: GachaState } {
  const pulls: GachaPull[] = [];
  let s = state;
  for (let i = 0; i < count; i++) {
    const r = pull(s, rng);
    pulls.push(r.pull);
    s = r.state;
  }
  return { pulls, state: s };
}
