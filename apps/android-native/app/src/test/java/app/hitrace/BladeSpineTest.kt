package app.hitrace

import app.hitrace.data.Pt
import app.hitrace.ui.BladeSpine
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs
import kotlin.math.sin

/**
 * The blade is supposed to *be* the route. These pin down the part that makes that claim true or
 * false: the same route must always produce the same recognisable shape, and different routes
 * must produce different ones.
 */
class BladeSpineTest {

    private val cx = 100f
    private val top = 20f
    private val bottom = 320f
    private val maxLateral = 80f

    /** The engine normalises a route into [0,1]² preserving aspect, so fixtures do the same. */
    private fun course(n: Int = 64, f: (Double) -> Pair<Double, Double>): List<Pt> {
        val raw = (0 until n).map { i -> f(i.toDouble() / (n - 1)) }
        val minX = raw.minOf { it.first }; val minY = raw.minOf { it.second }
        val span = maxOf(raw.maxOf { it.first } - minX, raw.maxOf { it.second } - minY).takeIf { it > 0 } ?: 1.0
        return raw.map { Pt((it.first - minX) / span, (it.second - minY) / span) }
    }

    private fun lateralSpread(pts: List<androidx.compose.ui.geometry.Offset>) =
        pts.maxOf { it.x } - pts.minOf { it.x }

    @Test
    fun `a straight run makes a straight blade`() {
        // The failure this guards against: scaling the sideways extent to fill the blade, which
        // turns a straight run's GPS noise into dramatic curves.
        val straight = course { f -> (f * 6000) to (sin(f * 40) * 3.0) } // ±3 m of wobble over 6 km
        val spine = BladeSpine.build(straight, cx, top, bottom, maxLateral)
        assertNotNull(spine)
        assertTrue(
            "a straight course must not curve, spread was ${lateralSpread(spine!!.out)}",
            lateralSpread(spine.out) < 6f,
        )
    }

    @Test
    fun `a winding run makes a winding blade`() {
        val winding = course { f -> (f * 6000) to (sin(f * Math.PI * 2) * 450) }
        val spine = BladeSpine.build(winding, cx, top, bottom, maxLateral)!!
        assertTrue("a winding course must show it, got ${lateralSpread(spine.out)}", lateralSpread(spine.out) > 25f)
    }

    @Test
    fun `the blade runs grip to tip in the direction it was run`() {
        val spine = BladeSpine.build(course { f -> (f * 6000) to 0.0 }, cx, top, bottom, maxLateral)!!
        // Canvas y grows downward: the grip is at the bottom, the tip at the top.
        assertEquals(bottom, spine.out.first().y, 2f)
        assertEquals(top, spine.out.last().y, 2f)
    }

    @Test
    fun `a course run in the opposite direction still points the same way`() {
        val forward = BladeSpine.build(course { f -> (f * 6000) to 0.0 }, cx, top, bottom, maxLateral)!!
        val backward = BladeSpine.build(course { f -> ((1 - f) * 6000) to 0.0 }, cx, top, bottom, maxLateral)!!
        assertEquals(bottom, backward.out.first().y, 2f)
        assertEquals(top, backward.out.last().y, 2f)
        assertEquals(forward.out.last().y, backward.out.last().y, 2f)
    }

    @Test
    fun `an out and back becomes two edges, not a folded blade`() {
        // Out 3 km and home again, 60 m to one side on the return.
        val outAndBack = course(120) { f ->
            val g = if (f < 0.5) f * 2 else (1 - f) * 2
            (g * 3000) to (if (f < 0.5) 60.0 else -60.0)
        }
        val spine = BladeSpine.build(outAndBack, cx, top, bottom, maxLateral)!!
        assertNotNull("the return leg must become the far edge", spine.back)
        // Both legs are ordered grip → tip, so neither doubles back on itself.
        for (leg in listOf(spine.out, spine.back!!)) {
            assertEquals(bottom, leg.first().y, 6f)
            assertEquals(top, leg.last().y, 6f)
            val descending = leg.zipWithNext().count { (a, b) -> b.y > a.y + 1f }
            assertTrue("a leg must not fold back on itself, $descending points went backwards", descending == 0)
        }
        // The two legs are on opposite sides — that is what makes it double-edged.
        val outMid = spine.out[spine.out.size / 2].x
        val backMid = spine.back!![spine.back!!.size / 2].x
        assertTrue("the two legs should sit either side of centre", (outMid - cx) * (backMid - cx) < 0)
        // …but they must meet at the grip and at the point, or the blade has a flat top.
        assertEquals(spine.out.first().x, spine.back!!.first().x, 0.5f)
        assertEquals(spine.out.last().x, spine.back!!.last().x, 0.5f)
        assertEquals(spine.out.last().y, spine.back!!.last().y, 0.5f)
    }

    @Test
    fun `a one way run has no second edge`() {
        val spine = BladeSpine.build(course { f -> (f * 6000) to (f * 400) }, cx, top, bottom, maxLateral)!!
        assertNull(spine.back)
    }

    @Test
    fun `a round course is squeezed into a blade instead of a blob`() {
        val loop = course(96) { f ->
            val a = f * 2 * Math.PI
            (kotlin.math.cos(a) * 1000) to (sin(a) * 1000)
        }
        val spine = BladeSpine.build(loop, cx, top, bottom, maxLateral)!!
        val length = spine.out.maxOf { it.y } - spine.out.minOf { it.y }
        assertTrue(
            "even a circular course must read as a blade, ${lateralSpread(spine.out)} wide vs $length long",
            lateralSpread(spine.out) <= length * 0.5f,
        )
    }

    @Test
    fun `the taper comes to a point`() {
        assertTrue(BladeSpine.halfWidth(0f, 30f) > 25f)
        assertTrue(BladeSpine.halfWidth(0.5f, 30f) > 15f)
        assertEquals(0f, BladeSpine.halfWidth(1f, 30f), 0.01f)
        // Monotonic — a blade must not bulge back out on the way to the point.
        var previous = Float.MAX_VALUE
        for (i in 0..20) {
            val hw = BladeSpine.halfWidth(i / 20f, 30f)
            assertTrue("width must never grow toward the tip", hw <= previous + 0.01f)
            previous = hw
        }
    }

    @Test
    fun `too few points falls back rather than crashing`() {
        assertNull(BladeSpine.build(listOf(Pt(0.0, 0.0), Pt(1.0, 1.0)), cx, top, bottom, maxLateral))
        assertNull(BladeSpine.build(emptyList(), cx, top, bottom, maxLateral))
    }

    @Test
    fun `distinct courses make distinct blades`() {
        val a = BladeSpine.build(course { f -> (f * 6000) to (sin(f * Math.PI * 2) * 450) }, cx, top, bottom, maxLateral)!!
        val b = BladeSpine.build(course { f -> (f * 6000) to (sin(f * Math.PI * 5) * 450) }, cx, top, bottom, maxLateral)!!
        val difference = a.out.indices.sumOf { abs(a.out[it].x - b.out[it].x).toDouble() } / a.out.size
        assertTrue("two different courses must not draw the same blade, mean gap $difference px", difference > 5.0)
    }
}
