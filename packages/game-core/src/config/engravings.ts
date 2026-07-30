// Engraving catalogue + effective-stat / synergy math. Engravings add flat stat
// mods (folded into effective stats & CP) and optional combat triggers. Two
// engravings sharing a `set` grant a synergy bonus — build depth, zero P2W.

import type { Engraving, Stats } from '../types.js';

export interface EngravingDef extends Engraving {
  /** Set tag for synergies. */
  set?: string;
  /** Engrave-stone cost to apply. */
  cost: number;
}

export const ENGRAVING_CATALOG: EngravingDef[] = [
  { id: 'dawn_pierce', name: '새벽 · 관통', rarity: 'SR', mods: { sharpness: 60 }, trigger: 'pierce', set: 'dawn', cost: 2 },
  { id: 'mountain_might', name: '산 · 강타', rarity: 'SR', mods: { weight: 80 }, set: 'mountain', cost: 2 },
  { id: 'steady_guard', name: '지구 · 방벽', rarity: 'R', mods: { durability: 70 }, set: 'mountain', cost: 1 },
  { id: 'arcane_surge', name: '비전 · 폭주', rarity: 'LEGEND', mods: { magic: 90 }, trigger: 'magic_boost', set: 'dawn', cost: 2 },
  { id: 'river_flow', name: '유수 · 연격', rarity: 'R', mods: { sharpness: 30, magic: 20 }, set: 'river', cost: 1 },
];

const BY_ID = new Map(ENGRAVING_CATALOG.map((e) => [e.id, e]));
export function getEngraving(id: string): EngravingDef | undefined {
  return BY_ID.get(id);
}

const STAT_KEYS: Array<keyof Stats> = ['sharpness', 'weight', 'durability', 'magic'];

/** Base stats + summed flat engraving mods + synergy bonus. */
export function effectiveStats(base: Stats, engravings: Array<Engraving | null>): Stats {
  const out: Stats = { ...base };
  for (const e of engravings) {
    if (!e) continue;
    for (const k of STAT_KEYS) {
      const v = e.mods[k];
      if (typeof v === 'number' && v >= 1) out[k] += v; // flat mod (values <1 are % triggers)
    }
  }
  // Synergy: a completed set adds +6% to every stat.
  for (const syn of activeSynergies(engravings)) {
    void syn;
    for (const k of STAT_KEYS) out[k] = Math.round(out[k] * 1.06);
  }
  return out;
}

export interface Synergy { set: string; name: string }

/** Sets with ≥2 engravings present are active. */
export function activeSynergies(engravings: Array<Engraving | null>): Synergy[] {
  const counts = new Map<string, number>();
  for (const e of engravings) {
    if (!e) continue;
    const set = (getEngraving(e.id)?.set) ?? undefined;
    if (set) counts.set(set, (counts.get(set) ?? 0) + 1);
  }
  const NAMES: Record<string, string> = { dawn: '새벽의 결', mountain: '산의 결', river: '유수의 결' };
  return [...counts.entries()].filter(([, n]) => n >= 2).map(([set]) => ({ set, name: NAMES[set] ?? set }));
}
