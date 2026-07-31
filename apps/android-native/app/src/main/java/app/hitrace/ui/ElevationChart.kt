package app.hitrace.ui

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import app.hitrace.data.GpsPointDto
import app.hitrace.data.RunMath
import app.hitrace.ui.theme.Rb

/**
 * Elevation over distance — the "was this hilly?" answer at a glance.
 *
 * X is cumulative distance (not sample index): GPS samples bunch up when you slow down,
 * so an index-based X would stretch the climbs you walked.
 */
@Composable
fun ElevationChart(points: List<GpsPointDto>, modifier: Modifier = Modifier) {
    val withEle = points.filter { it.ele != null }
    Canvas(modifier) {
        val w = size.width
        val h = size.height
        val padY = h * 0.12f

        val grid = Rb.Surface4.copy(alpha = 0.4f)
        for (gy in 1..2) drawLine(grid, Offset(0f, h * gy / 3f), Offset(w, h * gy / 3f), strokeWidth = 1f)
        if (withEle.size < 3) return@Canvas

        // Cumulative distance for each sample.
        val xs = ArrayList<Float>(withEle.size)
        var acc = 0.0
        xs.add(0f)
        for (i in 1 until withEle.size) {
            acc += RunMath.haversine(withEle[i - 1], withEle[i])
            xs.add(acc.toFloat())
        }
        val total = xs.last().takeIf { it > 1f } ?: return@Canvas

        val eles = withEle.map { it.ele!!.toFloat() }
        val minE = eles.min()
        val maxE = eles.max()
        val span = (maxE - minE).takeIf { it > 1f } ?: 1f

        fun px(i: Int) = xs[i] / total * w
        fun py(i: Int) = h - padY - (eles[i] - minE) / span * (h - padY * 2)

        val line = Path().apply {
            moveTo(px(0), py(0))
            for (i in 1 until withEle.size) lineTo(px(i), py(i))
        }
        val area = Path().apply {
            addPath(line)
            lineTo(w, h)
            lineTo(0f, h)
            close()
        }
        drawPath(
            area,
            brush = Brush.verticalGradient(listOf(Rb.Blue.copy(alpha = 0.28f), Rb.Blue.copy(alpha = 0.02f))),
        )
        drawPath(line, color = Rb.Blue, style = Stroke(width = 2.5f))
    }
}
