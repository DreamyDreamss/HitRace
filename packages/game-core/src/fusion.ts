// 합주조 (fusion): combine two SR+ swords into one. Stats are the CP-weighted
// average of the parents with a fixed penalty (prevents spam). Cosmetic: blade
// comes from A, guard/handle style hints from B. Inherits one engraving.

import { BALANCE } from './config/balance.js';
import { computeCP } from './conversion.js';
import type { Rarity, Stats, Sword } from './types.js';

const RARITY_RANK: Record<Rarity, number> = { N: 0, R: 1, SR: 2, LEGEND: 3 };
const RANK_RARITY: Rarity[] = ['N', 'R', 'SR', 'LEGEND'];

export interface FusionValidation {
  ok: boolean;
  reason?: string;
}

export function validateFusion(a: Sword, b: Sword): FusionValidation {
  if (a.id === b.id) return { ok: false, reason: 'same_sword' };
  const minRank = RARITY_RANK[BALANCE.fusion.minRarity];
  if (RARITY_RANK[a.rarity] < minRank || RARITY_RANK[b.rarity] < minRank) {
    return { ok: false, reason: 'below_min_rarity' };
  }
  return { ok: true };
}

export interface FusionContext {
  id: string;
  ownerId: string;
  createdAt: number;
  name?: string;
}

export function fuseSwords(a: Sword, b: Sword, ctx: FusionContext): Sword {
  const wa = a.cp || 1;
  const wb = b.cp || 1;
  const total = wa + wb;
  const penalty = 1 - BALANCE.fusion.statPenalty;

  const blend = (ka: number, kb: number) => Math.round(((ka * wa + kb * wb) / total) * penalty);
  const stats: Stats = {
    sharpness: blend(a.stats.sharpness, b.stats.sharpness),
    weight: blend(a.stats.weight, b.stats.weight),
    durability: blend(a.stats.durability, b.stats.durability),
    magic: blend(a.stats.magic, b.stats.magic),
  };

  const rarity = RANK_RARITY[Math.max(RARITY_RANK[a.rarity], RARITY_RANK[b.rarity])]!;

  // Inherit one engraving (first non-null across both parents).
  const inherited = [...a.engravings, ...b.engravings].filter(Boolean).slice(0, BALANCE.fusion.inheritEngravings);
  const slots = rarity === 'LEGEND' ? 3 : rarity === 'SR' ? 2 : 1;
  const engravings = Array.from({ length: slots }, (_, i) => inherited[i] ?? null);

  return {
    id: ctx.id,
    ownerId: ctx.ownerId,
    name: ctx.name ?? `합 · ${a.name}`,
    rarity,
    stats,
    shape: { ...a.shape, transform: undefined }, // blade from A; reset any prior workshop transform
    plus: 0,
    cp: computeCP(stats),
    engravings,
    runId: a.runId,
    courseHash: a.courseHash,
    createdAt: ctx.createdAt,
  };
}

/** Preview stats without constructing a full sword (for the UI). */
export function previewFusion(a: Sword, b: Sword): { stats: Stats; cp: number } {
  const dummy = fuseSwords(a, b, { id: 'preview', ownerId: a.ownerId, createdAt: 0 });
  return { stats: dummy.stats, cp: dummy.cp };
}
