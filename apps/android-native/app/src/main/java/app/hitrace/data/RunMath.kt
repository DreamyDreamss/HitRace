package app.hitrace.data

import kotlin.math.PI
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

// Client-side preview math — mirrors game-core (server stays authoritative for the real forge).
object RunMath {
    private const val EARTH_R = 6_371_000.0
    private fun rad(d: Double) = d * PI / 180.0

    fun haversine(a: GpsPointDto, b: GpsPointDto): Double {
        val dLat = rad(b.lat - a.lat); val dLng = rad(b.lng - a.lng)
        val h = sin(dLat / 2).let { it * it } +
            cos(rad(a.lat)) * cos(rad(b.lat)) * sin(dLng / 2).let { it * it }
        return 2 * EARTH_R * asin(min(1.0, sqrt(h)))
    }

    /** Total distance, skipping blackout legs so the live figure matches what the server scores. */
    fun pathMeters(pts: List<GpsPointDto>): Double {
        var d = 0.0
        for (i in 1 until pts.size) if (!pts[i].gap) d += haversine(pts[i - 1], pts[i])
        return d
    }

    fun elevationGain(pts: List<GpsPointDto>): Double {
        var g = 0.0
        for (i in 1 until pts.size) {
            val p = pts[i - 1].ele; val c = pts[i].ele
            if (p != null && c != null && c > p) g += c - p
        }
        return g
    }

    data class Metrics(val distanceKm: Double, val durationSec: Double, val paceSecPerKm: Double, val elevationM: Double)

    fun metrics(pts: List<GpsPointDto>): Metrics {
        if (pts.size < 2) return Metrics(0.0, 0.0, 0.0, 0.0)
        val distM = pathMeters(pts)
        val distKm = distM / 1000.0
        val dur = (pts.last().t - pts.first().t) / 1000.0
        val pace = if (distKm > 0.02) dur / distKm else 0.0
        return Metrics(distKm, dur, pace, elevationGain(pts))
    }

    data class Score(val total: Int, val rarity: String, val base: Int, val pace: Int, val explore: Int, val negSplit: Int, val elev: Int)

    fun score(m: Metrics, isNewCourse: Boolean = true): Score {
        val base = (min(1.0, m.distanceKm / 8.0) * 52).roundToInt()
        val pace = if (m.paceSecPerKm in 0.1..330.0) 14 else 0
        val explore = if (isNewCourse) 10 else 0
        val negSplit = 0
        val elev = min(16, ((m.elevationM / 100).toInt()) * 4)
        val total = base + pace + explore + negSplit + elev
        return Score(total, rarityOf(total), base, pace, explore, negSplit, elev)
    }

    fun rarityOf(score: Int): String = when {
        score >= 90 -> "LEGEND"
        score >= 70 -> "SR"
        score >= 40 -> "R"
        else -> "N"
    }

    /**
     * Mirrors the engine's finishing power (0..1, 0.5 = evenly paced) so the summary screen can
     * show what the run earned before it is submitted. The server's number is authoritative;
     * this exists so the runner sees the consequence of how they paced while it still means
     * something to them.
     */
    fun finishingPower(pts: List<GpsPointDto>): Double {
        if (pts.size < 6) return 0.5
        val start = pts.first().t
        val total = pts.last().t - start
        if (total <= 0) return 0.5

        var cut = pts.indexOfFirst { it.t - start >= total / 2 }
        if (cut < 1 || cut >= pts.size - 1) cut = pts.size / 2
        val first = pts.subList(0, cut + 1)
        val second = pts.subList(cut, pts.size)
        val d1 = pathMeters(first)
        val d2 = pathMeters(second)
        if (d1 < 200 || d2 < 200) return 0.5
        val s1 = (first.last().t - first.first().t) / 1000.0
        val s2 = (second.last().t - second.first().t) / 1000.0
        if (s1 <= 0 || s2 <= 0) return 0.5
        val p1 = s1 / (d1 / 1000.0)
        val p2 = s2 / (d2 / 1000.0)
        val splitScore = balanced((p1 - p2) / p1, 0.12)

        val totalM = pathMeters(pts)
        val totalSec = (pts.last().t - start) / 1000.0
        if (totalM < 800 || totalSec <= 0) return splitScore
        val stretch = min(1000.0, totalM * 0.25)
        var covered = 0.0
        var i = pts.size - 1
        while (i > 0 && covered < stretch) { covered += haversine(pts[i - 1], pts[i]); i-- }
        if (covered < 200) return splitScore
        val sec = (pts.last().t - pts[i].t) / 1000.0
        if (sec <= 0) return splitScore
        val closing = sec / (covered / 1000.0)
        val avg = totalSec / (totalM / 1000.0)
        val surgeScore = balanced((avg - closing) / avg, 0.15)
        return (splitScore * 0.6 + surgeScore * 0.4).coerceIn(0.0, 1.0)
    }

    private fun balanced(delta: Double, span: Double) = ((delta / span).coerceIn(-1.0, 1.0) + 1) / 2

    /** Plain-language reading of [finishingPower]. */
    fun finishingLabel(p: Double): String = when {
        p >= 0.72 -> "후반 폭발"
        p >= 0.58 -> "후반 상승"
        p > 0.42 -> "고른 페이스"
        p > 0.28 -> "후반 저하"
        else -> "후반 급저하"
    }

    fun oreReward(distanceKm: Double) = (distanceKm * 8).roundToInt()
    fun ticketReward(distanceKm: Double) = if (distanceKm >= 3) 1 else 0

    /**
     * Pace over the most recent kilometre — what a runner glances down for mid-run.
     * Returns 0 until a full kilometre of history exists (a partial lap would read
     * wildly fast or slow and be worse than showing nothing).
     */
    fun lastKmPace(pts: List<GpsPointDto>): Double {
        if (pts.size < 2) return 0.0
        var meters = 0.0
        var i = pts.size - 1
        while (i > 0 && meters < 1000.0) {
            meters += haversine(pts[i - 1], pts[i])
            i--
        }
        if (meters < 1000.0) return 0.0
        val sec = (pts.last().t - pts[i].t) / 1000.0
        return if (sec > 0) sec / (meters / 1000.0) else 0.0
    }

    fun paceLabel(secPerKm: Double): String {
        if (secPerKm <= 0) return "—'—\""
        val m = (secPerKm / 60).toInt(); val s = (secPerKm % 60).roundToInt()
        return "$m'${s.toString().padStart(2, '0')}\""
    }
}
