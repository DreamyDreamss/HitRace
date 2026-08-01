// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for every tunable number. Formulas reference this;
// nothing is a magic literal. The economically-sensitive values are mirrored
// into the DB `balance_config` table so ops can tune prod without a redeploy.
// ─────────────────────────────────────────────────────────────────────────────

export const BALANCE = {
  run: {
    minDistanceKm: 1.0,
    minDurationSec: 600, // 10 min
    /** Faster than this pace (sec/km) is implausible ⇒ forge fails. 3'00"/km = 180. */
    minPlausiblePaceSecPerKm: 180,
    /** GPS jump: > this speed (m/s) between samples flags a teleport. ~10 m/s ≈ 36 km/h. */
    maxPlausibleSpeedMps: 10,
    /**
     * Share of the run's *distance* (not its sample count) that may be above running speed
     * before it's called a vehicle. Set high on purpose: shortening a real run is worse than
     * letting the odd bus ride through, and noisy fixes cluster.
     */
    vehicleDistanceShare: 0.3,
    /** Max swords forge-able per calendar day. */
    maxForgesPerDay: 2,
    /** Score decay starts at this repeat index (0-based → 3rd run). */
    repeatDecayFromIndex: 2,
    /** Multiplicative decay per repeat beyond the threshold. */
    repeatDecayPerStep: 0.15,
    /** Round-trip / loop closure threshold in metres between start & end. */
    loopClosureMeters: 60,
    /** Manual/treadmill (no-GPS) runs are capped below LEGEND to preserve GPS prestige. */
    manualScoreCeiling: 89, // SR max
    /** Manual runs earn ore but not forge tickets (tickets stay a GPS incentive). */
    manualGrantsTicket: false,
  },

  score: {
    // Base (distance·time) up to +52
    baseMax: 52,
    baseDistanceKmForMax: 8, // ~8km saturates base
    // Pace bonus if avg pace ≤ threshold
    paceBonusThresholdSecPerKm: 330, // 5'30"
    paceBonus: 14,
    explorationBonus: 10, // brand-new course
    negativeSplitBonus: 5,
    elevationBonusPer100m: 4,
    elevationBonusCap: 16,
  },

  rarity: {
    // score thresholds (inclusive lower bound)
    R: 40,
    SR: 70,
    LEGEND: 90,
  } as const,

  stats: {
    // Map metrics → stat points. Tuned so a strong 8km run lands ~600-850.
    sharpness: { minPaceSecPerKm: 240, maxPaceSecPerKm: 420, min: 250, max: 900 },
    weight: { perElevationM: 6, cap: 900, floor: 120 },
    durability: { base: 760, stabilityPenaltyPerCv: 900, floor: 200 },
    magic: { maxFromZone: 700, floor: 120 },
  },

  combat: {
    hp: 3000,
    rounds: 5,
    cp: { sharpness: 1, weight: 0.7, durability: 0.5, magic: 0.8 },
    critWeightDivisor: 1000,
    durabilityMitigationK: 1200,
    skillGaugeMax: 100,
    /** Magic gauge charged per round = magic / this. */
    gaugeChargeDivisor: 6,
    skillDamageMultiplier: 1.9,
  },

  economy: {
    caps: { oreDaily: 600, engraveStoneWeekly: 5 },
    ore: {
      perKm: 8,
      dailyQuestMin: 100,
      dailyQuestMax: 300,
      dismantleByRarity: { N: 4, R: 12, SR: 24, LEGEND: 40 } as Record<string, number>,
    },
    upgrade: {
      baseCost: 120,
      costGrowth: 1.4, // cost(+n) = baseCost * growth^n
      reforgeOreCost: 400,
      engraveReRollCost: 200,
    },
    ticket: {
      per3kmRun: 1,
      weekly3RunsBonus: 3,
    },
  },

  upgrade: {
    // Success probability by target plus. Failure: keep grade, plus −1.
    baseSuccess: 0.95,
    successFalloffPerPlus: 0.06,
    minSuccess: 0.25,
    /** Weekly running bonus: +this per km up to cap, added to success. */
    runnerBonusPerKm: 0.003,
    runnerBonusCap: 0.1,
    /** Whetstone streak: +this per consecutive running day, up to cap. */
    streakBonusPerDay: 0.01,
    streakBonusCap: 0.07,
    // Stat gain per +1 as a fraction of base stat.
    statGainPerPlus: { sharpness: 0.07, weight: 0.045, durability: 0.037, magic: 0.05 },
  },

  gacha: {
    ticketPerPull: 1,
    ticketPer10Pull: 9,
    pityCount: 90, // 천장
    rates: {
      legendMaterial: 0.012,
      engraveStone: 0.065,
      upgradeOre: 0.923,
    },
  },

  pvp: {
    matchBandInitial: 0.08,
    matchBandWidenedAtSec: 30,
    matchBandWidened: 0.15,
    ghostFallbackAtSec: 60,
    rp: { winMin: 18, winMax: 24, lossMin: 12, lossMax: 18 },
    seasonSoftResetTiers: 2,
  },

  fusion: {
    minRarity: 'SR' as const,
    consumeCount: 2,
    statPenalty: 0.1, // weighted-average −10%
    inheritEngravings: 1,
  },
} as const;

export type Balance = typeof BALANCE;
