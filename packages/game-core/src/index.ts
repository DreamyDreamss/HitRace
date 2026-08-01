// @hitrace/game-core — pure game engine. No I/O, no framework, fully deterministic.

export * from './types.js';
export { BALANCE } from './config/balance.js';
export type { Balance } from './config/balance.js';
export { Rng } from './rng.js';
export * from './geo.js';
export { validateRun, sanitizeTrack } from './anticheat.js';
export type { ValidateOptions } from './anticheat.js';
export {
  deriveMetrics,
  deriveStats,
  deriveShape,
  computeForgeScore,
  rarityFromScore,
  computeCP,
  fingerprint,
} from './conversion.js';
export { computeSplits, bestKmPace } from './splits.js';
// ── 속성 (날씨) ───────────────────────────────────────────────────────────────
export {
  ELEMENTS,
  ELEMENT_LABEL,
  ELEMENT_WEATHER,
  ELEMENT_ADVANTAGE,
  ELEMENT_DISADVANTAGE,
  elementAdvantage,
  elementMatchup,
  elementFromWeather,
  bossElement,
} from './element.js';
export type { Element, WeatherSample } from './element.js';

// ── 동네 보스 ─────────────────────────────────────────────────────────────────
export { bossMaxHp, joinBoss, nextCycleStartTier } from './boss/hp.js';
export {
  computeDamage,
  allocateRegions,
  paceFactor,
  elevationFactor,
  swordFactor,
  streakFactor,
} from './boss/damage.js';
export type { DamageInput, DamageBreakdown, RegionShare } from './boss/damage.js';
export { bossName, bossSeed, weekKey, monthKey } from './boss/naming.js';
export { distributeRewards } from './boss/rewards.js';
export type { Contribution, Payout } from './boss/rewards.js';
export { awakenCost, awakenBonus, applyAwakening, maxAwakenStage } from './boss/awaken.js';
export type { AwakenCost } from './boss/awaken.js';
export type { Split } from './splits.js';
export { forgeSword } from './forge.js';
export type { ForgeContext, ForgeOutcome } from './forge.js';
export {
  upgradeCost,
  upgradeSuccessChance,
  streakBonus,
  nextStreak,
  applyUpgrade,
  dismantleYield,
  runOreReward,
  runTicketReward,
  grantCapped,
} from './economy.js';
export { pull, pullMany } from './gacha.js';
export type { GachaState, GachaPull, GachaTier } from './gacha.js';
export { simulateCombat } from './combat.js';
export { fuseSwords, validateFusion, previewFusion } from './fusion.js';
export type { FusionContext, FusionValidation } from './fusion.js';
export { generateProceduralTrack, forgeManual } from './manual.js';
export type { ManualForgeContext } from './manual.js';
export { ENGRAVING_CATALOG, getEngraving, effectiveStats, activeSynergies } from './config/engravings.js';
export type { EngravingDef, Synergy } from './config/engravings.js';
export {
  matchBand,
  inBand,
  rpDelta,
  tierFromRp,
  seasonSoftReset,
  TIERS,
  STEPS_PER_TIER,
  RP_PER_STEP,
} from './matching.js';
export type { Tier } from './matching.js';
