package app.hitrace.ui

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import app.hitrace.ui.theme.Rb
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * A boss, drawn rather than downloaded.
 *
 * There are 3,482 행정동. Nobody is going to illustrate a creature for each of them, and shipping
 * art would mean shipping megabytes for places most players will never see. So the silhouette is
 * derived from the boss's seed the same way a blade is derived from its route — the app's whole
 * premise is that things are generated from real data.
 *
 * The seed fixes the shape, so a neighbourhood's boss looks the same to everyone and stays
 * recognisable all week. Tier only sharpens it: more spikes, more angular, more saturated.
 */
@Composable
fun BossCanvas(seed: String, tier: Int, modifier: Modifier = Modifier, alive: Boolean = true) {
    Canvas(modifier) {
        val w = size.width
        val h = size.height
        val cx = w / 2f
        val cy = h * 0.52f
        val radius = minOf(w, h) * 0.40f

        val rng = SeedRng(seed)
        // Higher tiers grow more horns; the count is what reads first at a glance.
        val lobes = 7 + (tier - 1).coerceIn(0, 5)
        val spikiness = 0.18f + 0.06f * (tier - 1).coerceIn(0, 5)

        val body = Path()
        val steps = lobes * 12
        for (i in 0..steps) {
            val t = i.toFloat() / steps
            val angle = t * 2f * PI.toFloat() - PI.toFloat() / 2f
            // A wobble that repeats `lobes` times, plus a seeded per-lobe variation so two
            // neighbourhoods with the same tier are not the same creature.
            val lobe = sin(angle * lobes + rng.phase)
            val wobble = 1f + spikiness * lobe + 0.10f * sin(angle * 3f + rng.phase2)
            val r = radius * wobble
            val x = cx + cos(angle) * r
            val y = cy + sin(angle) * r * 0.92f
            if (i == 0) body.moveTo(x, y) else body.lineTo(x, y)
        }
        body.close()

        val tone = tierColor(tier)
        val fill = if (alive) tone else Rb.Muted
        drawPath(
            body,
            brush = Brush.verticalGradient(
                colors = listOf(fill.copy(alpha = 0.85f), fill.copy(alpha = 0.35f)),
                startY = cy - radius, endY = cy + radius,
            ),
        )
        drawPath(body, color = fill, style = Stroke(width = 3f))

        if (!alive) return@Canvas

        // Two eyes, placed off the seed so they sit differently on each boss.
        val eyeY = cy - radius * 0.18f
        val eyeGap = radius * (0.30f + 0.10f * rng.unit)
        val eyeR = radius * 0.085f
        for (side in listOf(-1f, 1f)) {
            drawCircle(Rb.Screen, radius = eyeR, center = Offset(cx + side * eyeGap, eyeY))
            drawCircle(
                Rb.GoldHi,
                radius = eyeR * 0.45f,
                center = Offset(cx + side * eyeGap, eyeY + eyeR * 0.15f),
            )
        }
    }
}

/** Tier reads as colour before anyone parses the number next to it. */
private fun tierColor(tier: Int): Color = when {
    tier <= 1 -> Rb.Blue
    tier == 2 -> Rb.Green
    tier == 3 -> Rb.Purple
    tier == 4 -> Rb.Gold
    else -> Rb.Red
}

/** Tiny deterministic hash → the few constants the silhouette needs. Same seed, same boss. */
private class SeedRng(seed: String) {
    private val h: Int = run {
        var x = 1779033703 xor seed.length
        for (c in seed) {
            x = (x xor c.code) * 3432918353.toInt()
            x = (x shl 13) or (x ushr 19)
        }
        x xor (x ushr 16)
    }

    val unit: Float get() = ((h ushr 8) and 0xFFFF) / 65535f
    val phase: Float get() = (h and 0xFF) / 255f * 2f * PI.toFloat()
    val phase2: Float get() = ((h ushr 16) and 0xFF) / 255f * 2f * PI.toFloat()
}
