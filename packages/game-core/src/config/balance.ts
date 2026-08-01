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
    // Magic comes from finishing power (see conversion.ts). An even run scores 0.5 → 470,
    // which is exactly the neutral value swords were given while this stat had no real source,
    // so nothing already forged is devalued by the change.
    magic: { maxFromFinish: 700, floor: 120 },
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

  // ── 동네 보스 ───────────────────────────────────────────────────────────────
  boss: {
    /**
     * HP of a tier-1 boss facing one runner. Calibrated so a solo runner clears it in about a
     * week: a CP 1600 sword over 6 km at 5'30" deals ≈ 10,000, so four runs.
     */
    baseHp: 40_000,
    /** Each cleared tier makes the next one this much sturdier. */
    tierHpGrowth: 1.6,
    /**
     * Extra HP per additional participant. Below 1.0 on purpose: five runners face 3.4× the HP,
     * not 5×, so **each of them does less work than a soloist would**. Calling a neighbour in has
     * to make your own week easier, or nobody calls.
     */
    hpPerExtraParticipant: 0.6,

    /** Pace at which the pace multiplier is exactly 1.0, and where it saturates. */
    paceNeutralSecPerKm: 360, // 6'00"
    paceBestSecPerKm: 240, // 4'00"
    paceFactorRange: { min: 0.8, max: 1.4 },
    /** Elevation: 1 + gain × this, capped. */
    elevationPerMeter: 1 / 500,
    elevationFactorCap: 1.3,
    /**
     * Sword contribution: (cp / cpReference)^cpExponent. The exponent is well under 1 so tripling
     * CP roughly doubles damage — the sword clearly matters, but a veteran cannot drown out a
     * neighbourhood of new runners. This is a running app: distance leads, the sword multiplies.
     */
    cpReference: 1000,
    cpExponent: 0.8,
    /** No sword equipped — you still contribute, weakly. */
    noSwordFactor: 0.5,
    /** Reuses the running streak the app already tracks. */
    streakBonusPerDay: 0.03,
    streakBonusCap: 0.2,

    /** Damaging runs per day, per region. Running more is fine; it just stops adding damage. */
    maxDamagingRunsPerDay: 3,
    /** A region taking less than this share of a run is noise, not a visit. */
    minRegionShare: 0.1,
    /** At most this many regions credited from one run. */
    maxRegionsPerRun: 3,

    /** Mana stones for clearing a tier-1 boss; scales with tier. */
    stoneBaseReward: 6,
    stoneTierGrowth: 1.45,
    /** Half of the drop is for showing up, half tracks contribution. */
    stoneParticipationShare: 0.5,
    /** Below this share of the boss's HP you get nothing. */
    minRewardShare: 0.01,
    /** Extra stones for the top contributor and for whoever lands the kill. */
    topContributorBonus: 4,
    finalBlowBonus: 3,
  },

  /** 각성 — growth past the upgrade ceiling, paid for with boss drops. Never fails. */
  awakening: {
    maxStage: 5,
    /** stage → { manaStone, ore, statBonus } */
    stages: [
      { manaStone: 8, ore: 800, statBonus: 0.06 },
      { manaStone: 20, ore: 2_000, statBonus: 0.13 },
      { manaStone: 45, ore: 4_500, statBonus: 0.21 },
      { manaStone: 90, ore: 9_000, statBonus: 0.30 },
      { manaStone: 180, ore: 18_000, statBonus: 0.40 },
    ],
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
