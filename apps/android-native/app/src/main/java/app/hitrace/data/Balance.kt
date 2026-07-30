package app.hitrace.data

import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt

/**
 * Client-side mirror of `packages/game-core` balance + economy math, used only for PREVIEWS
 * (upgrade odds, stat deltas, drop rates). The server stays authoritative for every mutation.
 * Keep in sync with `config/balance.ts` and `economy.ts`.
 */
object Balance {
    // economy.upgrade
    private const val UPGRADE_BASE_COST = 120.0
    private const val UPGRADE_COST_GROWTH = 1.4

    // upgrade
    private const val BASE_SUCCESS = 0.95
    private const val FALLOFF_PER_PLUS = 0.06
    private const val MIN_SUCCESS = 0.25
    private const val RUNNER_BONUS_PER_KM = 0.003
    private const val RUNNER_BONUS_CAP = 0.10
    private const val STREAK_BONUS_PER_DAY = 0.01
    private const val STREAK_BONUS_CAP = 0.07
    private const val GAIN_SHARPNESS = 0.07
    private const val GAIN_WEIGHT = 0.045
    private const val GAIN_DURABILITY = 0.037
    private const val GAIN_MAGIC = 0.05

    // combat.cp weights
    private const val CP_SHARPNESS = 1.0
    private const val CP_WEIGHT = 0.7
    private const val CP_DURABILITY = 0.5
    private const val CP_MAGIC = 0.8

    // gacha
    const val GACHA_PITY_COUNT = 90
    const val GACHA_TICKET_PER_PULL = 1
    const val GACHA_TICKET_PER_10 = 9
    val GACHA_RATES = listOf(
        "legendMaterial" to 0.012,
        "engraveStone" to 0.065,
        "upgradeOre" to 0.923,
    )

    fun upgradeCost(currentPlus: Int): Int =
        (UPGRADE_BASE_COST * UPGRADE_COST_GROWTH.pow(currentPlus)).roundToInt()

    fun upgradeSuccessChance(currentPlus: Int, weeklyKm: Double, streakDays: Int = 0): Double {
        val runner = min(RUNNER_BONUS_CAP, weeklyKm * RUNNER_BONUS_PER_KM)
        val streak = streakBonus(streakDays)
        val base = BASE_SUCCESS - currentPlus * FALLOFF_PER_PLUS + runner + streak
        return max(MIN_SUCCESS, min(0.99, base))
    }

    fun streakBonus(streakDays: Int): Double =
        min(STREAK_BONUS_CAP, max(0, streakDays) * STREAK_BONUS_PER_DAY)

    fun applyUpgrade(s: Stats): Stats = Stats(
        sharpness = (s.sharpness * (1 + GAIN_SHARPNESS)).roundToInt(),
        weight = (s.weight * (1 + GAIN_WEIGHT)).roundToInt(),
        durability = (s.durability * (1 + GAIN_DURABILITY)).roundToInt(),
        magic = (s.magic * (1 + GAIN_MAGIC)).roundToInt(),
    )

    fun computeCp(s: Stats): Int = (
        s.sharpness * CP_SHARPNESS + s.weight * CP_WEIGHT +
            s.durability * CP_DURABILITY + s.magic * CP_MAGIC
        ).roundToInt()
}

/** 합주조 preview — CP-weighted average of both parents, −10% (mirrors `previewFusion`). */
fun previewFusion(a: Sword, b: Sword): Stats {
    val wa = if (a.cp > 0) a.cp else 1
    val wb = if (b.cp > 0) b.cp else 1
    val total = wa + wb
    fun blend(ka: Int, kb: Int) = ((ka.toDouble() * wa + kb.toDouble() * wb) / total * 0.9).roundToInt()
    return Stats(
        sharpness = blend(a.stats.sharpness, b.stats.sharpness),
        weight = blend(a.stats.weight, b.stats.weight),
        durability = blend(a.stats.durability, b.stats.durability),
        magic = blend(a.stats.magic, b.stats.magic),
    )
}

private val RARITY_RANK = mapOf("N" to 0, "R" to 1, "SR" to 2, "LEGEND" to 3)

/** Fusion needs two distinct SR+ swords (mirrors `validateFusion`). */
fun canFuse(a: Sword, b: Sword): Boolean =
    a.id != b.id && (RARITY_RANK[a.rarity] ?: 0) >= 2 && (RARITY_RANK[b.rarity] ?: 0) >= 2

private val TIERS = listOf("Iron", "Bronze", "Silver", "Gold", "Platinum", "Legend")
private const val STEPS_PER_TIER = 4
private const val RP_PER_STEP = 100

/** Ladder label for a rank-point total — mirrors `tierFromRp` (matching.ts): "G2" style. */
fun tierLabel(rp: Int): String {
    val totalSteps = max(0, rp / RP_PER_STEP)
    val tierIdx = min(TIERS.size - 1, totalSteps / STEPS_PER_TIER)
    val step = STEPS_PER_TIER - (totalSteps % STEPS_PER_TIER)
    return "${TIERS[tierIdx][0]}$step"
}

/** Mirror of ENGRAVING_CATALOG (config/engravings.ts) for the picker sheet. */
data class EngravingDef(val id: String, val name: String, val rarity: String, val cost: Int, val set: String?)

val ENGRAVING_CATALOG = listOf(
    EngravingDef("dawn_pierce", "새벽 · 관통", "SR", 2, "dawn"),
    EngravingDef("mountain_might", "산 · 강타", "SR", 2, "mountain"),
    EngravingDef("steady_guard", "지구 · 방벽", "R", 1, "mountain"),
    EngravingDef("arcane_surge", "비전 · 폭주", "LEGEND", 2, "dawn"),
    EngravingDef("river_flow", "유수 · 연격", "R", 1, "river"),
)

private val SET_NAMES = mapOf("dawn" to "새벽의 결", "mountain" to "산의 결", "river" to "유수의 결")

/** Sets with ≥2 engravings equipped are active (mirrors activeSynergies). */
fun activeSynergyNames(engravings: List<Engraving?>): List<String> {
    val counts = mutableMapOf<String, Int>()
    engravings.filterNotNull().forEach { e ->
        val set = ENGRAVING_CATALOG.firstOrNull { it.id == e.id }?.set ?: return@forEach
        counts[set] = (counts[set] ?: 0) + 1
    }
    return counts.filterValues { it >= 2 }.keys.map { SET_NAMES[it] ?: it }
}
