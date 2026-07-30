package app.hitrace.ui

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import app.hitrace.data.GpsPointDto
import app.hitrace.ui.theme.Rb

// Draws the GPS path (normalized) as the runner's glowing trace — native Canvas.
@Composable
fun RouteTrace(points: List<GpsPointDto>, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        val w = size.width; val h = size.height
        val pad = h * 0.1f
        // grid
        val grid = Rb.Surface4.copy(alpha = 0.4f)
        for (gy in 1..3) drawLine(grid, Offset(0f, h * gy / 4f), Offset(w, h * gy / 4f), strokeWidth = 1f)
        for (gx in 1..4) drawLine(grid, Offset(w * gx / 5f, 0f), Offset(w * gx / 5f, h), strokeWidth = 1f)
        if (points.size < 2) return@Canvas
        val lats = points.map { it.lat }; val lngs = points.map { it.lng }
        val minLat = lats.min(); val minLng = lngs.min()
        val spanLat = (lats.max() - minLat).takeIf { it > 1e-9 } ?: 1.0
        val spanLng = (lngs.max() - minLng).takeIf { it > 1e-9 } ?: 1.0
        val span = maxOf(spanLat, spanLng)
        fun px(p: GpsPointDto) = Offset(
            (pad + ((p.lng - minLng) / span) * (w - 2 * pad)).toFloat(),
            (h - pad - ((p.lat - minLat) / span) * (h - 2 * pad)).toFloat(),
        )
        val path = Path()
        points.forEachIndexed { i, p -> val o = px(p); if (i == 0) path.moveTo(o.x, o.y) else path.lineTo(o.x, o.y) }
        drawPath(path, Rb.Gold, style = Stroke(width = 5f, cap = StrokeCap.Round))
        drawCircle(Rb.Muted, radius = 6f, center = px(points.first()))
        drawCircle(Rb.Gold, radius = 7f, center = px(points.last()))
    }
}
