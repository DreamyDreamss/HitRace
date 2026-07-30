package app.hitrace

import app.hitrace.data.Balance
import app.hitrace.data.ENGRAVING_CATALOG
import app.hitrace.data.Shape
import app.hitrace.data.Stats
import app.hitrace.data.Sword
import app.hitrace.data.previewFusion
import app.hitrace.data.tierLabel
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * `data/Balance.kt` is a hand-written mirror of `packages/game-core`. This test checks it against
 * the engine's own answers, captured in `balance-fixture.json`.
 *
 * Regenerate the fixture after any game-core balance change:
 *   cd apps/api && node --import tsx ../../apps/android-native/tools/gen-balance-fixture.mjs
 */
class BalanceParityTest {
    private val fixture: JsonObject = run {
        val text = javaClass.classLoader!!.getResourceAsStream("balance-fixture.json")!!
            .bufferedReader().readText()
        Json.parseToJsonElement(text).jsonObject
    }

    private fun stats(o: JsonObject) = Stats(
        sharpness = o["sharpness"]!!.jsonPrimitive.int,
        weight = o["weight"]!!.jsonPrimitive.int,
        durability = o["durability"]!!.jsonPrimitive.int,
        magic = o["magic"]!!.jsonPrimitive.int,
    )

    private fun sword(id: String, s: Stats, cp: Int, rarity: String) = Sword(
        id = id, name = id, rarity = rarity, stats = s, shape = Shape(), plus = 0, cp = cp,
    )

    @Test
    fun `gacha constants match the engine`() {
        val g = fixture["gacha"]!!.jsonObject
        assertEquals(g["pityCount"]!!.jsonPrimitive.int, Balance.GACHA_PITY_COUNT)
        assertEquals(g["ticketPerPull"]!!.jsonPrimitive.int, Balance.GACHA_TICKET_PER_PULL)
        assertEquals(g["ticketPer10Pull"]!!.jsonPrimitive.int, Balance.GACHA_TICKET_PER_10)

        val rates = g["rates"]!!.jsonObject
        assertEquals(rates.size, Balance.GACHA_RATES.size)
        Balance.GACHA_RATES.forEach { (tier, rate) ->
            assertEquals("rate for $tier", rates[tier]!!.jsonPrimitive.double, rate, 1e-9)
        }
    }

    @Test
    fun `upgrade cost curve matches the engine`() {
        fixture["upgradeCost"]!!.jsonObject.forEach { (plus, cost) ->
            assertEquals("cost at +$plus", cost.jsonPrimitive.int, Balance.upgradeCost(plus.toInt()))
        }
    }

    @Test
    fun `upgrade success chance matches the engine`() {
        fixture["upgradeSuccessChance"]!!.jsonArray.forEach { case ->
            val c = case.jsonObject
            val plus = c["plus"]!!.jsonPrimitive.int
            val weeklyKm = c["weeklyKm"]!!.jsonPrimitive.double
            val streak = c["streak"]!!.jsonPrimitive.int
            assertEquals(
                "chance at +$plus / ${weeklyKm}km / ${streak}d",
                c["chance"]!!.jsonPrimitive.double,
                Balance.upgradeSuccessChance(plus, weeklyKm, streak),
                1e-9,
            )
        }
    }

    @Test
    fun `streak bonus matches the engine`() {
        fixture["streakBonus"]!!.jsonObject.forEach { (days, bonus) ->
            assertEquals("bonus at ${days}d", bonus.jsonPrimitive.double, Balance.streakBonus(days.toInt()), 1e-9)
        }
    }

    @Test
    fun `stat gain per upgrade matches the engine`() {
        fixture["applyUpgrade"]!!.jsonArray.forEach { case ->
            val c = case.jsonObject
            assertEquals(stats(c["to"]!!.jsonObject), Balance.applyUpgrade(stats(c["from"]!!.jsonObject)))
        }
    }

    @Test
    fun `cp formula matches the engine`() {
        fixture["computeCP"]!!.jsonArray.forEach { case ->
            val c = case.jsonObject
            assertEquals(c["cp"]!!.jsonPrimitive.int, Balance.computeCp(stats(c["stats"]!!.jsonObject)))
        }
    }

    @Test
    fun `tier ladder labels match the engine`() {
        fixture["tierLabel"]!!.jsonObject.forEach { (rp, label) ->
            assertEquals("tier at ${rp}rp", label.jsonPrimitive.content, tierLabel(rp.toInt()))
        }
    }

    @Test
    fun `fusion preview matches the engine`() {
        val f = fixture["fusion"]!!.jsonObject
        val a = f["a"]!!.jsonObject
        val b = f["b"]!!.jsonObject
        val parentA = sword("a", stats(a["stats"]!!.jsonObject), a["cp"]!!.jsonPrimitive.int, "SR")
        val parentB = sword("b", stats(b["stats"]!!.jsonObject), b["cp"]!!.jsonPrimitive.int, "LEGEND")

        val blended = f["blended"]!!.jsonObject
        val expected = stats(blended["stats"]!!.jsonObject)
        val actual = previewFusion(parentA, parentB)
        assertEquals(expected, actual)
        assertEquals(blended["cp"]!!.jsonPrimitive.int, Balance.computeCp(actual))
    }

    @Test
    fun `engraving catalogue matches the engine`() {
        val expected = fixture["engravings"]!!.jsonArray.map { it.jsonObject }
        assertEquals(expected.size, ENGRAVING_CATALOG.size)
        expected.forEachIndexed { i, e ->
            val got = ENGRAVING_CATALOG[i]
            assertEquals(e["id"]!!.jsonPrimitive.content, got.id)
            assertEquals(e["name"]!!.jsonPrimitive.content, got.name)
            assertEquals(e["rarity"]!!.jsonPrimitive.content, got.rarity)
            assertEquals(e["cost"]!!.jsonPrimitive.int, got.cost)
            assertEquals(e["set"]!!.jsonPrimitive.content, got.set)
        }
    }
}
