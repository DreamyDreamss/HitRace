package app.hitrace.data

import kotlinx.serialization.Serializable

@Serializable
data class Stats(
    val sharpness: Int = 0,
    val weight: Int = 0,
    val durability: Int = 0,
    val magic: Int = 0,
)

@Serializable
data class BladeTransform(
    val rotate: Int = 0,
    val flipH: Boolean = false,
    val flipV: Boolean = false,
    val mirror: Boolean = false,
    val scale: Double = 1.0,
)

/** Cosmetic route-timeline split (fractions of the run assigned to each part). */
@Serializable
data class BladeParts(val blade: Double = 0.58, val guard: Double = 0.20, val handle: Double = 0.22)

/** A point on the blade's spine, in the engine's normalised [0,1]² route space. */
@Serializable
data class Pt(val x: Double, val y: Double)

@Serializable
data class Shape(
    val style: String = "straight",
    val trueDoubleEdge: Boolean = false,
    val procedural: Boolean = false,
    val lengthScale: Double = 0.5,
    val transform: BladeTransform? = null,
    val parts: BladeParts? = null,
    /**
     * The run's own path, normalised. The server has always sent this; the app used to drop it
     * and draw a generic leaf, which is why every sword looked the same. It is the blade's spine.
     */
    val centerline: List<Pt> = emptyList(),
    /** Self-intersections of the route → rune positions along the blade. */
    val runeAnchors: List<Pt> = emptyList(),
)

@Serializable
data class Engraving(
    val id: String,
    val name: String,
    val rarity: String,
)

@Serializable
data class Sword(
    val id: String,
    val name: String,
    val rarity: String,
    val stats: Stats,
    val shape: Shape,
    val plus: Int = 0,
    val cp: Int = 0,
    val engravings: List<Engraving?> = emptyList(),
    val courseHash: String = "",
    /** 각성 단계 0..5 — boss drops pay for growth past the upgrade ceiling. */
    val awakening: Int = 0,
    /** 속성 — the weather this run happened in: fire·water·wind·ice·none. */
    val element: String = "none",
)

@Serializable
data class Wallet(val ore: Int = 0, val engraveStone: Int = 0, val forgeTicket: Int = 0, val manaStone: Int = 0)

@Serializable
data class User(
    val id: String,
    val handle: String,
    val rankRp: Int = 0,
    val equippedSwordId: String? = null,
    val gachaPity: Int = 0,
    val streakDays: Int = 0,
    val maxHeartRate: Int = 190,
)

@Serializable
data class LoginBody(val handle: String)

@Serializable
data class LoginResp(val token: String, val user: User)

@Serializable
data class ForgeBudget(val today: Int = 0, val max: Int = 2) {
    val remaining: Int get() = (max - today).coerceAtLeast(0)
    val exhausted: Boolean get() = remaining <= 0
}

@Serializable
data class MeResp(
    val user: User,
    val wallet: Wallet,
    val swordCount: Int = 0,
    val equipped: Sword? = null,
    val forge: ForgeBudget = ForgeBudget(),
)

@Serializable
data class RankingRow(val rank: Int, val handle: String, val cp: Int, val rankRp: Int)

@Serializable
data class Rewards(val ore: Int = 0, val oreCapped: Boolean = false, val forgeTicket: Int = 0)

@Serializable
data class GpsPointDto(
    val lat: Double,
    val lng: Double,
    val ele: Double? = null,
    val t: Long,
    /**
     * Recording resumed here after a blackout — the straight line back to the previous point was
     * not necessarily run, so neither client nor server counts it as distance.
     */
    val gap: Boolean = false,
)

@Serializable
data class TrackDto(
    val points: List<GpsPointDto>,
    val cadence: List<Double>? = null,
    val heartRate: List<Double>? = null,
    val maxHeartRate: Int = 190,
)

@Serializable
data class RunBody(val track: TrackDto, val forge: Boolean = true, val name: String? = null)

@Serializable
data class GoalBonus(val ore: Int = 0, val forgeTicket: Int = 0)

/** Returned when a run pushes the week's total across the goal. */
@Serializable
data class WeeklyGoalResult(
    val achieved: Boolean = false,
    val goalKm: Int = 0,
    val weekKm: Double = 0.0,
    val bonus: GoalBonus = GoalBonus(),
)

// ── 동네 보스 ────────────────────────────────────────────────────────────────

@Serializable
data class BossRegion(val code: String = "", val name: String = "", val sido: String? = null, val level: String = "dong")

@Serializable
data class BossInfo(
    val id: String = "",
    val name: String = "",
    val tier: Int = 1,
    val hp: Long = 0,
    val maxHp: Long = 1,
    val seed: String = "",
    val element: String = "none",
    val participants: Int = 0,
    val cycleKey: String = "",
) {
    val hpFraction: Float get() = if (maxHp > 0) (hp.toDouble() / maxHp).toFloat().coerceIn(0f, 1f) else 0f
}

@Serializable
data class BossContributor(
    val rank: Int = 0,
    val userId: String = "",
    val handle: String = "",
    val damage: Long = 0,
    val runs: Int = 0,
)

@Serializable
data class BossStatus(
    val region: BossRegion? = null,
    val boss: BossInfo? = null,
    val leaderboard: List<BossContributor> = emptyList(),
)

/** What one run did to one region's boss — shown on the forge/summary screen. */
@Serializable
data class BossHit(
    val region: BossRegion = BossRegion(),
    val distanceKm: Double = 0.0,
    val damage: Long = 0,
    val boss: BossInfo = BossInfo(),
    val killed: Boolean = false,
    val manaStone: Int = 0,
    /** strong | weak | even — why the damage number looks like it does. */
    val matchup: String = "even",
)

@Serializable
data class BossOutcome(val hits: List<BossHit> = emptyList(), val manaStone: Int = 0)

@Serializable
data class BossPrivacy(val anonymous: Boolean = false, val available: Boolean = false)

@Serializable
data class PrivacyBody(val anonymous: Boolean)

@Serializable
data class AwakenResult(val stage: Int = 0, val cost: AwakenCost = AwakenCost())

@Serializable
data class AwakenCost(val manaStone: Int = 0, val ore: Int = 0, val statBonus: Double = 0.0)

@Serializable
data class ForgeResult(
    val sword: Sword? = null,
    val rewards: Rewards = Rewards(),
    val records: RunRecords = RunRecords(),
    val weeklyGoal: WeeklyGoalResult = WeeklyGoalResult(),
    val boss: BossOutcome? = null,
)

@Serializable
data class Totals(
    val swords: Int = 0,
    val byRarity: Map<String, Int> = emptyMap(),
    val bestCp: Int = 0,
    val totalKm: Double = 0.0,
    val runCount: Int = 0,
)

@Serializable
data class ProfileResp(val user: User, val totals: Totals)

@Serializable
data class UpgradeBody(val weeklyKm: Double)

@Serializable
data class UpgradeResp(val success: Boolean, val chance: Double, val cost: Int, val sword: Sword)

@Serializable
data class EngraveBody(val slot: Int, val engravingId: String)

@Serializable
data class Synergy(val set: String, val name: String)

@Serializable
data class EngraveResp(val sword: Sword, val synergies: List<Synergy> = emptyList())

@Serializable
data class GachaBody(val count: Int)

@Serializable
data class GachaPull(val tier: String, val pity: Boolean = false)

@Serializable
data class GachaGrants(val ore: Int = 0, val engraveStone: Int = 0, val legendMaterial: Int = 0)

@Serializable
data class GachaResp(
    val pulls: List<GachaPull> = emptyList(),
    val grants: GachaGrants = GachaGrants(),
    val pity: Int = 0,
    val spentTickets: Int = 0,
)

@Serializable
data class GhostSword(
    val name: String = "",
    val rarity: String = "N",
    val shape: Shape = Shape(),
    val stats: Stats = Stats(),
    val cadence: Double = 170.0,
)

@Serializable
data class Opponent(val id: String, val handle: String = "", val cp: Int = 0, val sword: GhostSword = GhostSword())

@Serializable
data class MatchResp(
    val found: Boolean = false,
    val band: Double = 0.08,
    val ghostFallback: Boolean = false,
    val opponent: Opponent? = null,
)

@Serializable
data class ResolveBody(val ghostId: String)

@Serializable
data class CombatEvent(
    val round: Int,
    val actor: String,
    val kind: String,
    val damage: Int,
    val label: String,
    val aHp: Int,
    val bHp: Int,
)

@Serializable
data class Combat(val winner: String = "a", val rounds: Int = 0, val log: List<CombatEvent> = emptyList())

/** `/pvp/resolve` returns a slimmer opponent (handle + sword only) than `/pvp/match`. */
@Serializable
data class ResolveOpponent(val handle: String = "", val sword: GhostSword = GhostSword())

@Serializable
data class ResolveResp(
    val matchId: String,
    val combat: Combat = Combat(),
    val won: Boolean = false,
    val rpDelta: Int = 0,
    val rankRp: Int = 0,
    val opponent: ResolveOpponent = ResolveOpponent(),
)

@Serializable
data class SeasonMeta(val id: Int = 0, val name: String = "", val daysLeft: Int = 0)

@Serializable
data class SeasonPass(val seasonId: Int = 0, val level: Int = 0, val kmProgress: Double = 0.0, val isPremium: Boolean = false)

@Serializable
data class SeasonProgress(val intoLevel: Double = 0.0, val perLevel: Double = 12.0, val pct: Double = 0.0)

@Serializable
data class RewardItem(val kind: String = "ore", val amount: Int = 0)

@Serializable
data class SeasonReward(val level: Int, val free: RewardItem = RewardItem(), val premium: RewardItem = RewardItem(), val claimed: Boolean = false)

@Serializable
data class SeasonResp(
    val season: SeasonMeta = SeasonMeta(),
    val pass: SeasonPass = SeasonPass(),
    val progress: SeasonProgress = SeasonProgress(),
    val rewards: List<SeasonReward> = emptyList(),
)

@Serializable
data class CodexEntry(
    val courseHash: String,
    val name: String = "",
    val bestRarity: String = "N",
    val style: String = "straight",
    val bestScoreCp: Int = 0,
    val timesForged: Int = 1,
    val shape: Shape = Shape(),
)

// ── Running log ─────────────────────────────────────────────────────────────

@Serializable
data class RunSummary(
    val id: String,
    val status: String = "recorded",
    val distanceKm: Double = 0.0,
    val durationSec: Int = 0,
    val avgPaceSecPerKm: Int = 0,
    val elevationGainM: Int = 0,
    val courseHash: String = "",
    val swordId: String? = null,
    val startedAt: Long = 0,
    val createdAt: Long = 0,
) {
    val isIndoor: Boolean get() = courseHash.startsWith("treadmill")
}

@Serializable
data class Split(
    val km: Int,
    val distanceKm: Double = 1.0,
    val durationSec: Int = 0,
    val paceSecPerKm: Int = 0,
    val elevationGainM: Int = 0,
)

@Serializable
data class CourseCompare(
    val totalRuns: Int = 0,
    val attempt: Int = 0,
    val bestPaceSecPerKm: Int? = null,
    val isCourseBest: Boolean = false,
    val previousPaceSecPerKm: Int? = null,
    val deltaVsPreviousSec: Int? = null,
)

@Serializable
data class RunDetailResp(
    val run: RunSummary,
    val course: CourseCompare = CourseCompare(),
    val route: List<GpsPointDto> = emptyList(),
    val splits: List<Split> = emptyList(),
    val bestKmPaceSecPerKm: Int? = null,
    val sword: Sword? = null,
)

@Serializable
data class VolumeStat(
    val runs: Int = 0,
    val distanceKm: Double = 0.0,
    val durationSec: Int = 0,
    val avgPaceSecPerKm: Int = 0,
)

@Serializable
data class WeeklyBucket(val weekStart: Long = 0, val distanceKm: Double = 0.0, val runs: Int = 0)

@Serializable
data class PersonalBests(
    val longestKm: Double = 0.0,
    val longestDurationSec: Int = 0,
    val fastestPaceSecPerKm: Int = 0,
    val biggestClimbM: Int = 0,
    val longestStreakDays: Int = 0,
)

@Serializable
data class GoalStat(
    val weeklyGoalKm: Int = 20,
    val daysLeftInWeek: Int = 7,
    val remainingKm: Double = 0.0,
    val progress: Double = 0.0,
    val achieved: Boolean = false,
)

@Serializable
data class GoalBody(val weeklyGoalKm: Int)

/** Which personal bests a run just beat — shown once, right after the run. */
@Serializable
data class RunRecords(
    val firstRun: Boolean = false,
    val longestDistance: Boolean = false,
    val longestDuration: Boolean = false,
    val fastestPace: Boolean = false,
    val biggestClimb: Boolean = false,
) {
    val any: Boolean get() = firstRun || longestDistance || longestDuration || fastestPace || biggestClimb
}

@Serializable
data class RunningStats(
    val goal: GoalStat = GoalStat(),
    val thisWeek: VolumeStat = VolumeStat(),
    val lastWeek: VolumeStat = VolumeStat(),
    val thisMonth: VolumeStat = VolumeStat(),
    val allTime: VolumeStat = VolumeStat(),
    val weekly: List<WeeklyBucket> = emptyList(),
    val personalBests: PersonalBests = PersonalBests(),
)

@Serializable
data class CourseScoreRow(
    val rank: Int,
    val userId: String = "",
    val handle: String = "",
    val bestScore: Int = 0,
    val bestCp: Int = 0,
)

@Serializable
data class CodexTotals(val courses: Int = 0, val legend: Int = 0)

@Serializable
data class CodexResp(val entries: List<CodexEntry> = emptyList(), val totals: CodexTotals = CodexTotals())

@Serializable
data class ManualRunBody(val distanceKm: Double, val paceSecPerKm: Int, val name: String? = null)

@Serializable
data class ReforgeBody(val shape: Shape)

@Serializable
data class FusionBody(val swordIds: List<String>, val name: String? = null)

@Serializable
data class FusionResp(val sword: Sword, val consumed: List<String> = emptyList())

@Serializable
data class DismantleBody(val swordIds: List<String>)

@Serializable
data class DismantleResp(val ore: Int = 0, val walletOre: Int = 0, val count: Int = 0)
