// Who gets what when a boss goes down.

import { BALANCE } from '../config/balance.js';

export interface Contribution {
  userId: string;
  damage: number;
}

export interface Payout {
  userId: string;
  manaStone: number;
  /** Share of the boss's total HP this runner dealt, 0..1. */
  share: number;
  topContributor: boolean;
  finalBlow: boolean;
}

/**
 * Splits a kill's mana stones across everyone who hit it.
 *
 * Half the drop is flat across participants and half tracks contribution. Pure contribution
 * scaling would mean the strongest runner takes nearly everything and nobody else has a reason to
 * show up; a pure flat split would mean showing up once for 200 m pays the same as carrying the
 * week. Half and half keeps both true.
 *
 * @param contributions everyone who dealt damage to this boss
 * @param tier the tier that was cleared — bigger bosses drop more
 * @param finalBlowUserId whoever landed the killing run
 */
export function distributeRewards(
  contributions: Contribution[],
  tier: number,
  finalBlowUserId?: string,
): Payout[] {
  const cfg = BALANCE.boss;
  const total = contributions.reduce((sum, c) => sum + Math.max(0, c.damage), 0);
  if (total <= 0) return [];

  // A token hit is not participation; without this floor a bot could farm every boss in a city
  // by contributing a metre each.
  const eligible = contributions.filter((c) => c.damage / total >= cfg.minRewardShare);
  if (eligible.length === 0) return [];

  const pool = cfg.stoneBaseReward * cfg.stoneTierGrowth ** (Math.max(1, tier) - 1);
  const top = eligible.reduce((best, c) => (c.damage > best.damage ? c : best), eligible[0]!);

  return eligible
    .map((c) => {
      const share = c.damage / total;
      const flat = pool * cfg.stoneParticipationShare;
      const earned = pool * (1 - cfg.stoneParticipationShare) * share * eligible.length;
      let stones = Math.round(flat + earned);
      const isTop = c.userId === top.userId;
      const isFinal = c.userId === finalBlowUserId;
      if (isTop) stones += cfg.topContributorBonus;
      if (isFinal) stones += cfg.finalBlowBonus;
      return {
        userId: c.userId,
        manaStone: Math.max(1, stones),
        share,
        topContributor: isTop,
        finalBlow: isFinal,
      };
    })
    .sort((a, b) => b.share - a.share);
}
