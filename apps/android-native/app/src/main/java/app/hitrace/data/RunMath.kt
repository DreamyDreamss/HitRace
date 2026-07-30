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

    fun pathMeters(pts: List<GpsPointDto>): Double {
        var d = 0.0
        for (i in 1 until pts.size) d += haversine(pts[i - 1], pts[i])
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

    fun oreReward(distanceKm: Double) = (distanceKm * 8).roundToInt()
    fun ticketReward(distanceKm: Double) = if (distanceKm >= 3) 1 else 0

    fun paceLabel(secPerKm: Double): String {
        if (secPerKm <= 0) return "—'—\""
        val m = (secPerKm / 60).toInt(); val s = (secPerKm % 60).roundToInt()
        return "$m'${s.toString().padStart(2, '0')}\""
    }
}
