package app.hitrace

import app.hitrace.data.GpsSmoother
import app.hitrace.data.LocationFilter
import app.hitrace.data.RunMath
import app.hitrace.data.GpsPointDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs

/**
 * The filter decides what counts as distance, and in this app distance is currency — so these
 * are economy tests as much as sensor tests.
 */
class LocationFilterTest {

    private val seoulLat = 37.5285
    private val seoulLng = 126.9330
    /** Metres → degrees of latitude (good enough at this scale). */
    private fun dLat(m: Double) = m / 111_320.0

    @Test
    fun `first fix must be accurate or it is rejected`() {
        val f = LocationFilter()
        assertFalse(f.offer(seoulLat, seoulLng, accuracyM = 40f, timeMs = 0))
        assertTrue(f.offer(seoulLat, seoulLng, accuracyM = 8f, timeMs = 1000))
        assertTrue(f.rebasedOnLastAccept)
    }

    @Test
    fun `a steady run is accepted fix after fix`() {
        val f = LocationFilter()
        var t = 0L
        var accepted = 0
        // 3 m/s (5'33"/km) sampled every second for a minute.
        for (i in 0..60) {
            if (f.offer(seoulLat + dLat(i * 3.0), seoulLng, 6f, t, speedMps = 3f, hasSpeed = true)) accepted++
            t += 1000
        }
        assertEquals(61, accepted)
    }

    @Test
    fun `standing still accrues no distance`() {
        val f = LocationFilter()
        assertTrue(f.offer(seoulLat, seoulLng, 12f, 0, speedMps = 0f, hasSpeed = true))
        // 60 seconds of jitter inside the accuracy radius while the device reports "stopped".
        var accepted = 0
        for (i in 1..60) {
            val jitter = dLat(if (i % 2 == 0) 6.0 else -6.0)
            if (f.offer(seoulLat + jitter, seoulLng, 12f, i * 1000L, speedMps = 0f, hasSpeed = true)) accepted++
        }
        // One fix is accepted at the 30s mark: with nothing accepted for that long the filter
        // rebases rather than jamming forever. That point is flagged as a gap by the caller, so
        // it carries no distance — which is what the next assertion is really about.
        assertTrue("standing jitter must barely register, got $accepted", accepted <= 2)
    }

    @Test
    fun `a blackout leg carries no distance`() {
        val pts = listOf(
            GpsPointDto(seoulLat, seoulLng, null, 0),
            GpsPointDto(seoulLat + dLat(300.0), seoulLng, null, 100_000),
            // Reappears 2 km away after 5 minutes in a tunnel.
            GpsPointDto(seoulLat + dLat(2300.0), seoulLng, null, 400_000, gap = true),
            GpsPointDto(seoulLat + dLat(2400.0), seoulLng, null, 430_000),
        )
        val d = RunMath.pathMeters(pts)
        assertTrue("gap leg must not be counted, got $d", abs(d - 400.0) < 20.0)
    }

    @Test
    fun `a slow walk still records`() {
        val f = LocationFilter()
        var t = 0L
        var accepted = 0
        // 1.1 m/s ≈ 4 km/h, sampled every 2s → 2.2 m per fix, under the 4 m still-threshold.
        for (i in 0..30) {
            if (f.offer(seoulLat + dLat(i * 2.2), seoulLng, 8f, t, speedMps = 1.1f, hasSpeed = true)) accepted++
            t += 2000
        }
        assertTrue("slow walking must not be filtered away, got $accepted", accepted >= 30)
    }

    @Test
    fun `a teleport is discarded and the chain survives it`() {
        val f = LocationFilter()
        assertTrue(f.offer(seoulLat, seoulLng, 6f, 0, speedMps = 3f, hasSpeed = true))
        // 5 km away one second later.
        assertFalse(f.offer(seoulLat + dLat(5000.0), seoulLng, 6f, 1000, speedMps = 3f, hasSpeed = true))
        // The real next fix continues from the good anchor.
        assertTrue(f.offer(seoulLat + dLat(6.0), seoulLng, 6f, 2000, speedMps = 3f, hasSpeed = true))
        assertEquals(1, f.rejectedCount)
    }

    @Test
    fun `returning from a blackout rebases instead of banking the gap`() {
        val f = LocationFilter()
        assertTrue(f.offer(seoulLat, seoulLng, 6f, 0, speedMps = 3f, hasSpeed = true))
        // 5 minutes in a tunnel, reappearing 2 km along — accepted as a new anchor, and the
        // caller is told not to add the straight-line distance.
        assertTrue(f.offer(seoulLat + dLat(2000.0), seoulLng, 10f, 300_000, speedMps = 3f, hasSpeed = true))
        assertTrue(f.rebasedOnLastAccept)
    }

    @Test
    fun `rebase makes the next fix a fresh anchor`() {
        val f = LocationFilter()
        assertTrue(f.offer(seoulLat, seoulLng, 6f, 0, speedMps = 3f, hasSpeed = true))
        f.rebase()
        assertTrue(f.offer(seoulLat + dLat(3000.0), seoulLng, 6f, 1000, speedMps = 3f, hasSpeed = true))
        assertTrue(f.rebasedOnLastAccept)
    }

    @Test
    fun `smoothing shortens a jittery straight line but keeps the real one`() {
        // Same path, once clean and once with lateral noise. Smoothing should pull the noisy
        // measurement of distance back toward the truth without shrinking the clean one.
        fun walk(noise: Boolean): Double {
            val s = GpsSmoother()
            val pts = (0..100).map { i ->
                val wobble = if (noise && i % 2 == 0) dLat(7.0) else if (noise) dLat(-7.0) else 0.0
                val (la, ln) = s.process(
                    seoulLat + dLat(i * 3.0), seoulLng + wobble, 10f, i * 1000L, 3.0,
                )
                GpsPointDto(la, ln, null, i * 1000L)
            }
            return RunMath.pathMeters(pts)
        }
        val clean = walk(noise = false)
        val noisy = walk(noise = true)
        // Truth is ~300 m. Unsmoothed, that zig-zag would measure well over 1.4 km.
        assertTrue("clean path preserved, got $clean", abs(clean - 300.0) < 30.0)
        assertTrue("jitter must not inflate distance, got $noisy", noisy < 450.0)
    }
}
