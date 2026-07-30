// Currency math: upgrade cost & probability, dismantle yield, reward calc.
// Pure functions — callers own persistence and cap enforcement against stored state.

import { BALANCE } from './config/balance.js';
import type { Rarity, Stats } from './types.js';

/** Ore cost to go from +n → +(n+1). */
export function upgradeCost(currentPlus: number): number {
  const u = BALANCE.economy.upgrade;
  return Math.round(u.baseCost * Math.pow(u.costGrowth, currentPlus));
}

/** Success probability of the next upgrade, including weekly-running + streak bonuses. */
export function upgradeSuccessChance(currentPlus: number, weeklyKm: number, streakDays = 0): number {
  const u = BALANCE.upgrade;
  const runnerBonus = Math.min(u.runnerBonusCap, weeklyKm * u.runnerBonusPerKm);
  const streakBonus = Math.min(u.streakBonusCap, Math.max(0, streakDays) * u.streakBonusPerDay);
  const base = u.baseSuccess - currentPlus * u.successFalloffPerPlus + runnerBonus + streakBonus;
  return Math.max(u.minSuccess, Math.min(0.99, base));
}

/** The streak's current contribution to upgrade success (for UI display). */
export function streakBonus(streakDays: number): number {
  const u = BALANCE.upgrade;
  return Math.min(u.streakBonusCap, Math.max(0, streakDays) * u.streakBonusPerDay);
}

/** Update a consecutive-day streak given the previous run day and today (epoch-day integers). */
export function nextStreak(prevStreak: number, lastRunDay: number | null, todayDay: number): number {
  if (lastRunDay == null) return 1;
  if (todayDay === lastRunDay) return Math.max(1, prevStreak); // already ran today
  if (todayDay === lastRunDay + 1) return prevStreak + 1; // consecutive
  return 1; // gap → reset
}

/** Stats after a successful +1 upgrade. */
export function applyUpgrade(stats: Stats, currentPlus: number): Stats {
  const g = BALANCE.upgrade.statGainPerPlus;
  return {
    sharpness: Math.round(stats.sharpness * (1 + g.sharpness)),
    weight: Math.round(stats.weight * (1 + g.weight)),
    durability: Math.round(stats.durability * (1 + g.durability)),
    magic: Math.round(stats.magic * (1 + g.magic)),
  };
}

/** Ore gained from dismantling one sword of a rarity (scaled by +level). */
export function dismantleYield(rarity: Rarity, plus = 0): number {
  const base = BALANCE.economy.ore.dismantleByRarity[rarity] ?? 4;
  return Math.round(base * (1 + plus * 0.25));
}

/** Ore earned from a run (distance-based), before the daily cap is applied by the caller. */
export function runOreReward(distanceKm: number): number {
  return Math.round(distanceKm * BALANCE.economy.ore.perKm);
}

/** Forge tickets earned from a run. */
export function runTicketReward(distanceKm: number): number {
  return distanceKm >= 3 ? BALANCE.economy.ticket.per3kmRun : 0;
}

/** Apply a positive amount to a currency balance, respecting a cap; returns the granted amount and new total. */
export function grantCapped(current: number, amount: number, cap: number): { granted: number; total: number } {
  const room = Math.max(0, cap - current);
  const granted = Math.min(room, amount);
  return { granted, total: current + granted };
}
