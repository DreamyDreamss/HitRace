// How much boss there is to kill.
//
// The whole content stands or falls on this curve. A brand-new app has one runner per
// neighbourhood, and if that one runner cannot finish a boss the feature may as well not exist.
// A hundred runners on the same boss must not flatten it in an afternoon either.

import { BALANCE } from '../config/balance.js';

/**
 * Maximum HP for a boss at [tier] facing [participants] runners.
 *
 * Participants add less than their share (0.6 each), so the burden *per person* falls as more
 * people join:
 *
 * | participants | HP     | each |
 * |--------------|--------|------|
 * | 1            |  40,000| 40,000 |
 * | 5            | 136,000| 27,200 |
 * | 20           | 496,000| 24,800 |
 *
 * That direction is the point. Bringing a neighbour in has to make your own week lighter, or
 * nobody brings anyone.
 */
export function bossMaxHp(tier: number, participants: number): number {
  const cfg = BALANCE.boss;
  const t = Math.max(1, Math.floor(tier));
  const p = Math.max(1, Math.floor(participants));
  const tierFactor = cfg.tierHpGrowth ** (t - 1);
  const crowdFactor = 1 + cfg.hpPerExtraParticipant * (p - 1);
  return Math.round(cfg.baseHp * tierFactor * crowdFactor);
}

/**
 * A newcomer joins a boss that is already underway.
 *
 * Their arrival raises the ceiling, and the *remaining* HP rises by the same proportion — so the
 * damage already dealt keeps its value. Scaling only `maxHp` would silently undo everyone's work;
 * scaling only `hp` would make joining late a punishment for the people already there.
 *
 * @returns the boss's new `{ maxHp, hp }`
 */
export function joinBoss(
  current: { maxHp: number; hp: number; tier: number; participants: number },
): { maxHp: number; hp: number; participants: number } {
  const participants = current.participants + 1;
  const maxHp = bossMaxHp(current.tier, participants);
  if (current.maxHp <= 0) return { maxHp, hp: maxHp, participants };
  const remainingShare = current.hp / current.maxHp;
  return { maxHp, hp: Math.round(maxHp * remainingShare), participants };
}

/**
 * Where next week starts. Clearing tier 5 does not mean starting there again — progress carries
 * but is re-earned, so a good week is worth repeating rather than banking forever.
 */
export function nextCycleStartTier(bestTierCleared: number): number {
  return Math.max(1, Math.floor(bestTierCleared) - 1);
}
