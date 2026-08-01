// What a run does to a boss.
//
// Running *is* the attack — there is no "attack" button anywhere in the app, and there must not
// be one. Everything below is computed server-side from a run that already survived anti-cheat.

import { BALANCE } from '../config/balance.js';

export interface DamageInput {
  /** Distance covered inside this particular region, in km. */
  distanceKm: number;
  /** The run's average pace, seconds per km. */
  paceSecPerKm: number;
  /** Elevation gained over the whole run, metres. */
  elevationGainM: number;
  /** CP of the sword the runner has equipped; 0 or undefined if none. */
  equippedCp?: number;
  /** Consecutive running days, as already tracked for upgrades. */
  streakDays?: number;
}

export interface DamageBreakdown {
  damage: number;
  distanceKm: number;
  paceFactor: number;
  elevationFactor: number;
  swordFactor: number;
  streakFactor: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Faster than 6'00"/km starts paying; it saturates at 4'00". Capped both ways so that neither a
 * walk nor a sprint decides the whole thing — this is a distance-led game.
 */
export function paceFactor(paceSecPerKm: number): number {
  const cfg = BALANCE.boss;
  if (!(paceSecPerKm > 0)) return cfg.paceFactorRange.min;
  const span = cfg.paceNeutralSecPerKm - cfg.paceBestSecPerKm;
  const t = (cfg.paceNeutralSecPerKm - paceSecPerKm) / span; // 0 at neutral, 1 at best
  const raw = 1 + t * (cfg.paceFactorRange.max - 1);
  return clamp(raw, cfg.paceFactorRange.min, cfg.paceFactorRange.max);
}

export function elevationFactor(gainM: number): number {
  const cfg = BALANCE.boss;
  return clamp(1 + Math.max(0, gainM) * cfg.elevationPerMeter, 1, cfg.elevationFactorCap);
}

/**
 * The sword's contribution, and the one number that decides whether this is an RPG or a
 * pedometer.
 *
 * `(cp / 1000)^0.8` — sub-linear on purpose. Tripling CP multiplies damage by 2.4, not 3, so
 * levelling a blade is visibly worth it while a veteran still cannot out-damage a neighbourhood
 * of ordinary runners. Distance leads; the sword multiplies.
 */
export function swordFactor(equippedCp?: number): number {
  const cfg = BALANCE.boss;
  if (!equippedCp || equippedCp <= 0) return cfg.noSwordFactor;
  return (equippedCp / cfg.cpReference) ** cfg.cpExponent;
}

export function streakFactor(streakDays = 0): number {
  const cfg = BALANCE.boss;
  return clamp(1 + Math.max(0, streakDays) * cfg.streakBonusPerDay, 1, 1 + cfg.streakBonusCap);
}

/** Damage one run deals to one region's boss, with every term kept for the UI to explain. */
export function computeDamage(input: DamageInput): DamageBreakdown {
  const distanceKm = Math.max(0, input.distanceKm);
  const pace = paceFactor(input.paceSecPerKm);
  const elevation = elevationFactor(input.elevationGainM);
  const sword = swordFactor(input.equippedCp);
  const streak = streakFactor(input.streakDays);
  return {
    damage: Math.round(distanceKm * pace * elevation * sword * streak * 1000),
    distanceKm,
    paceFactor: pace,
    elevationFactor: elevation,
    swordFactor: sword,
    streakFactor: streak,
  };
}

export interface RegionShare {
  code: string;
  distanceKm: number;
}

/**
 * Splits a run across the regions it actually crossed.
 *
 * Crediting only one region would punish anyone who lives near a boundary — a perfectly normal
 * 6 km loop can touch three 행정동. Slivers below [BALANCE.boss.minRegionShare] are dropped as
 * noise (a corner clipped for 200 m is not a visit), and only the top few survive.
 */
export function allocateRegions(shares: RegionShare[]): RegionShare[] {
  const cfg = BALANCE.boss;
  const total = shares.reduce((sum, s) => sum + Math.max(0, s.distanceKm), 0);
  if (total <= 0) return [];
  return shares
    .filter((s) => s.distanceKm / total >= cfg.minRegionShare)
    .sort((a, b) => b.distanceKm - a.distanceKm)
    .slice(0, cfg.maxRegionsPerRun);
}
