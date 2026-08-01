package app.hitrace.ui

import androidx.compose.ui.geometry.Offset
import app.hitrace.data.Pt
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin

/**
 * Turns a run's path into the spine of a blade.
 *
 * The engine sends the route normalised into a unit box, in whatever orientation it was run.
 * A sword is long and thin and hangs point-up, so the path has to be stood on end before it can
 * be a blade — and the run's *start* becomes the grip, its end the tip, so the blade reads in
 * the direction it was run.
 *
 * The only liberty taken with the shape is a cap on how wide it may be relative to its length
 * (see [MAX_LATERAL]). Most runs are already long and thin and pass through untouched; a route
 * that wanders in a square would otherwise render as a blob rather than a sword. Every bend
 * survives — they are compressed proportionally, never straightened.
 *
 * All of this is done at render time from the stored route, so swords forged before the app
 * started drawing routes gain their real shape too.
 */
object BladeSpine {

    /** Widest the blade may be, as a fraction of its length, before the route is compressed. */
    private const val MAX_LATERAL = 0.46

    /** Points along the resampled spine. Enough for a smooth edge, cheap enough to redraw. */
    private const val SAMPLES = 56

    /**
     * The blade's geometry, taken from the route.
     *
     * @param out the way there, grip → tip: the blade's leading edge
     * @param back the way home, also ordered grip → tip, when the run doubled back — that
     *   return leg becomes the *other* edge, so an out-and-back forges a literally two-edged
     *   blade whose two sides are the two directions it was run
     */
    data class Spine(val out: List<Offset>, val back: List<Offset>?)

    /**
     * @param centerline the route, normalised, as the engine stored it
     * @param cx blade centre-line x in canvas pixels
     * @param top y of the tip
     * @param bottom y where the blade meets the guard
     * @param maxLateral how far the spine may wander from [cx], in pixels
     * @return the blade spine, or null if the route can't make one
     */
    fun build(centerline: List<Pt>, cx: Float, top: Float, bottom: Float, maxLateral: Float): Spine? {
        if (centerline.size < 4) return null
        val pts = centerline.map { it.x to it.y }

        // 1. Longest axis of the path, via the covariance matrix. Start→end would collapse to
        //    nothing on a loop, which is exactly the case that most needs an orientation.
        val mx = pts.sumOf { it.first } / pts.size
        val my = pts.sumOf { it.second } / pts.size
        var sxx = 0.0; var syy = 0.0; var sxy = 0.0
        for ((x, y) in pts) {
            val dx = x - mx; val dy = y - my
            sxx += dx * dx; syy += dy * dy; sxy += dx * dy
        }
        // Principal direction of a symmetric 2×2 matrix.
        val theta = 0.5 * atan2(2 * sxy, sxx - syy)
        val ct = cos(theta); val st = sin(theta)

        // 2. Rotate so that axis is vertical: along = blade length, side = blade width.
        var rotated = pts.map { (x, y) ->
            val dx = x - mx; val dy = y - my
            (dx * ct + dy * st) to (-dx * st + dy * ct) // (along, side)
        }
        val alongSpan = rotated.maxOf { it.first } - rotated.minOf { it.first }
        val sideSpan = rotated.maxOf { it.second } - rotated.minOf { it.second }
        if (alongSpan <= 1e-6) return null

        // 3. The run starts at the grip. If the path runs the other way, turn it over rather
        //    than reversing the list — reversing would also mirror every bend.
        if (rotated.first().first > rotated.last().first) {
            rotated = rotated.map { (-it.first) to it.second }
        }

        // 4. Fit into the blade box.
        //
        // Both axes take the **same** scale, so the route keeps its proportions: a route that
        // barely deviates draws a straight blade, and one that snakes draws a snaking one.
        // (Stretching the sideways extent to fill the blade would amplify a straight run's GPS
        // noise into dramatic curves — the shape has to mean something.)
        val lengthPx = bottom - top
        val alongMin = rotated.minOf { it.first }
        val sideMid = (rotated.maxOf { it.second } + rotated.minOf { it.second }) / 2
        val scale = lengthPx / alongSpan

        // Only a route rounder than a sword gets compressed sideways, and only as far as it must.
        val lateralPx = sideSpan * scale
        val allowed = min(maxLateral * 2.0, lengthPx * MAX_LATERAL)
        val squeeze = if (lateralPx > allowed && lateralPx > 0) allowed / lateralPx else 1.0

        val fitted = rotated.map { (along, side) ->
            Offset(
                x = (cx + (side - sideMid) * scale * squeeze).toFloat(),
                y = (bottom - (along - alongMin) * scale).toFloat(),
            )
        }

        // 5. Out-and-back. Laying the whole path down the blade would send the spine up to the
        //    turnaround and straight back to the grip, folding the blade in half. Instead the two
        //    legs become the two edges: the way out and the way home, which is what a
        //    double-edged blade has always meant here.
        val turn = fitted.indices.maxByOrNull { -fitted[it].y } ?: 0
        val doubledBack = turn > fitted.size * 0.25 && turn < fitted.size * 0.75
        if (!doubledBack) return Spine(resample(fitted, SAMPLES), null)
        val outLeg = fitted.subList(0, turn + 1)
        val backLeg = fitted.subList(turn, fitted.size).reversed() // also grip → tip
        if (outLeg.size < 3 || backLeg.size < 3) return Spine(resample(fitted, SAMPLES), null)

        // A blade has one grip and one point. The two legs rarely start and end on exactly the
        // same spot — different side of the road, GPS drift — and left alone that gap becomes a
        // blunt, flat-topped slab instead of a tip. Weld them at both ends, leaving the middle
        // free to diverge, which is where the double edge actually comes from.
        val a = resample(outLeg, SAMPLES)
        val b = resample(backLeg, SAMPLES)
        val gripX = (a.first().x + b.first().x) / 2
        val tipX = (a.last().x + b.last().x) / 2
        val tipY = min(a.last().y, b.last().y)
        return Spine(weld(a, gripX, tipX, tipY), weld(b, gripX, tipX, tipY))
    }

    /**
     * Half-width at [t] (0 = grip, 1 = tip). A sword is not a leaf: the body tapers gently for
     * most of its length and then comes to a point over the last sixth. Tapering evenly the
     * whole way — which is what a plain curve does — reads as a blunt paddle.
     */
    fun halfWidth(t: Float, base: Float): Float {
        val u = t.coerceIn(0f, 1f).toDouble()
        val body = 1.0 - 0.35 * u // gentle narrowing along the blade
        val point = min(1.0, (1.0 - u) / POINT_FRACTION).pow(0.7) // the actual point
        return (base * body * point).toFloat()
    }

    /** Fraction of the blade's length given over to the point. */
    private const val POINT_FRACTION = 0.16

    /** Even spacing along the path, so the taper and the edges don't bunch up on slow sections. */
    private fun resample(path: List<Offset>, count: Int): List<Offset> {
        val lengths = DoubleArray(path.size)
        for (i in 1 until path.size) {
            lengths[i] = lengths[i - 1] + hypot(
                (path[i].x - path[i - 1].x).toDouble(),
                (path[i].y - path[i - 1].y).toDouble(),
            )
        }
        val total = lengths.last()
        if (total <= 0.0) return path
        val out = ArrayList<Offset>(count)
        var j = 1
        for (i in 0 until count) {
            val target = total * i / (count - 1)
            while (j < path.size - 1 && lengths[j] < target) j++
            val span = lengths[j] - lengths[j - 1]
            val f = if (span > 0) ((target - lengths[j - 1]) / span).toFloat() else 0f
            out.add(
                Offset(
                    path[j - 1].x + (path[j].x - path[j - 1].x) * f,
                    path[j - 1].y + (path[j].y - path[j - 1].y) * f,
                ),
            )
        }
        return out
    }

    /**
     * Pulls a leg onto a shared grip and tip. The correction is full at the ends and nearly
     * nothing in the middle, so the leg keeps the shape it was actually run.
     */
    private fun weld(leg: List<Offset>, gripX: Float, tipX: Float, tipY: Float): List<Offset> {
        val dxGrip = gripX - leg.first().x
        val dxTip = tipX - leg.last().x
        val dyTip = tipY - leg.last().y
        val last = leg.size - 1
        return leg.mapIndexed { i, p ->
            val t = i.toFloat() / last
            val fromGrip = (1f - t) * (1f - t)
            val toTip = t * t
            Offset(p.x + dxGrip * fromGrip + dxTip * toTip, p.y + dyTip * toTip)
        }
    }

    /** Unit normal at [i] along [spine], for offsetting the two edges. */
    fun normalAt(spine: List<Offset>, i: Int): Offset {
        val a = spine[max(0, i - 1)]
        val b = spine[min(spine.size - 1, i + 1)]
        val dx = b.x - a.x
        val dy = b.y - a.y
        val len = hypot(dx.toDouble(), dy.toDouble()).toFloat()
        if (len < 1e-4f) return Offset(1f, 0f)
        return Offset(-dy / len, dx / len)
    }

    /** How far the route wanders sideways, 0..1 — used to tell a bendy blade from a straight one. */
    fun waviness(centerline: List<Pt>): Float {
        if (centerline.size < 3) return 0f
        val first = centerline.first()
        val last = centerline.last()
        val straight = hypot(last.x - first.x, last.y - first.y)
        var path = 0.0
        for (i in 1 until centerline.size) {
            path += hypot(centerline[i].x - centerline[i - 1].x, centerline[i].y - centerline[i - 1].y)
        }
        if (path <= 0.0) return 0f
        return (1.0 - straight / path).coerceIn(0.0, 1.0).toFloat()
    }

    private fun hypot(x: Double, y: Double) = kotlin.math.sqrt(x * x + y * y)
}
