package app.hitrace.data

import kotlin.math.max

/**
 * Lightweight 1-D Kalman smoothing (latitude and longitude independently) — suppresses the
 * distance inflation that GPS jitter causes by zig-zagging a straight path.
 *
 * Model: the variance (P) grows with elapsed time by the process noise (q²·dt); the ratio against
 * the measurement variance (R = accuracy²) gives the Kalman gain k = P/(P+R) used to interpolate.
 * - Standing still (q = 2): jitter is absorbed hard, so ghost distance stops accumulating.
 * - Moving (q = speed): real movement is tracked quickly, so corners aren't cut.
 * - After a gap longer than [gapResetMs] (tunnel, pause) continuity is a meaningless assumption,
 *   so it snaps to the new measurement rather than dragging in from the stale one.
 *
 * Ported from the Rundex app, where it earned its parameters against real runs.
 */
class GpsSmoother(
    private val minAccuracyM: Float = 3f,
    private val minProcessNoiseMps: Double = 2.0,
    private val gapResetMs: Long = 10_000L,
) {
    private var lat = 0.0
    private var lng = 0.0
    private var varianceM2 = -1.0 // P. negative = uninitialised
    private var lastTimeMs = 0L

    /** @return the smoothed (lat, lng) */
    fun process(
        latMeasured: Double,
        lngMeasured: Double,
        accuracyM: Float,
        timeMs: Long,
        speedMps: Double,
    ): Pair<Double, Double> {
        val acc = max(accuracyM, minAccuracyM).toDouble()
        val r = acc * acc
        val gap = varianceM2 >= 0 && timeMs - lastTimeMs > gapResetMs
        if (varianceM2 < 0 || gap) {
            lat = latMeasured
            lng = lngMeasured
            varianceM2 = r
            lastTimeMs = timeMs
            return lat to lng
        }
        val dtSec = (timeMs - lastTimeMs) / 1000.0
        if (dtSec > 0) {
            val q = max(speedMps, minProcessNoiseMps)
            varianceM2 += dtSec * q * q
            lastTimeMs = timeMs
        }
        val k = varianceM2 / (varianceM2 + r)
        lat += k * (latMeasured - lat)
        lng += k * (lngMeasured - lng)
        varianceM2 *= (1 - k)
        return lat to lng
    }

    fun reset() {
        varianceM2 = -1.0
    }
}
