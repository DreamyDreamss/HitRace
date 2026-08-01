package app.hitrace.ui

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import app.hitrace.data.Shape
import app.hitrace.ui.theme.Rb

// Native Compose Canvas rendering of a sword — no WebView, no SVG. Shape from the run.
// The workshop transform (rotate/flip/scale) is a graphics-layer effect; the part split
// changes where the blade ends and the guard/handle begin. Both are cosmetic.
@Composable
fun BladeCanvas(shape: Shape, rarity: String, modifier: Modifier = Modifier, glow: Boolean = false) {
    val c = Rb.rarityColor(rarity)
    val t = shape.transform
    val layer = if (t == null) modifier else modifier.graphicsLayer {
        rotationZ = t.rotate.toFloat()
        scaleX = t.scale.toFloat() * (if (t.flipH) -1f else 1f)
        scaleY = t.scale.toFloat() * (if (t.flipV) -1f else 1f)
    }
    Canvas(modifier = layer) {
        val w = size.width
        val h = size.height
        val cx = w / 2f
        val bladeTop = h * 0.08f
        // Part split: with the default cut (0.58 of the route) the blade ends at 72% of the
        // height; moving the cut in the workshop lengthens or shortens the blade.
        val bladeFrac = (shape.parts?.blade ?: 0.58).toFloat()
        val span = h * 0.92f - bladeTop
        val bladeEnd = (0.762f + (bladeFrac - 0.58f) * 0.5f).coerceIn(0.55f, 0.88f)
        val bladeBottom = bladeTop + span * bladeEnd
        // Thickness follows the blade's own length, not the canvas width — otherwise the same
        // sword renders as a dagger in a tall cell and a cleaver in a wide one.
        val bladeLen = bladeBottom - bladeTop
        val bladeW = minOf(w * 0.26f, bladeLen * 0.115f)
        val doubleEdge = shape.trueDoubleEdge
        val edge = if (doubleEdge) bladeW * 1.05f else bladeW

        // The blade is the route. The spine follows the path that was actually run — start at the
        // grip, finish at the tip — and the two edges are that spine offset by a tapering width.
        // A route the engine couldn't turn into a spine (too few points, an old procedural
        // treadmill blade) falls back to the generic leaf.
        // The spine may wander as far as the canvas allows once the blade's own thickness is
        // accounted for, so a curving route isn't clipped at the edges.
        val geom = BladeSpine.build(shape.centerline, cx, bladeTop, bladeBottom, w / 2f - edge)
        val spine = geom?.out
        // The return leg shapes the far edge when the run doubled back; otherwise both edges
        // come off the same spine.
        val farEdge = geom?.back ?: spine
        val blade = if (spine == null || farEdge == null) {
            Path().apply {
                moveTo(cx, bladeTop)
                lineTo(cx + edge, bladeTop + h * 0.20f)
                lineTo(cx + edge * 0.55f, bladeBottom)
                lineTo(cx - edge * 0.55f, bladeBottom)
                lineTo(cx - edge, bladeTop + h * 0.20f)
                close()
            }
        } else {
            Path().apply {
                // Up one edge…
                spine.forEachIndexed { i, p ->
                    val t = i.toFloat() / (spine.size - 1)
                    val n = BladeSpine.normalAt(spine, i)
                    val hw = BladeSpine.halfWidth(t, edge)
                    val x = p.x + n.x * hw
                    val y = p.y + n.y * hw
                    if (i == 0) moveTo(x, y) else lineTo(x, y)
                }
                // …and back down the other.
                for (i in farEdge.indices.reversed()) {
                    val t = i.toFloat() / (farEdge.size - 1)
                    val n = BladeSpine.normalAt(farEdge, i)
                    val hw = BladeSpine.halfWidth(t, edge)
                    lineTo(farEdge[i].x - n.x * hw, farEdge[i].y - n.y * hw)
                }
                close()
            }
        }
        val tip = spine?.lastOrNull() ?: Offset(cx, bladeTop)
        val heel = spine?.firstOrNull() ?: Offset(cx, bladeBottom)

        if (glow) {
            drawPath(blade, color = c.copy(alpha = 0.28f), style = Stroke(width = 14f))
        }
        drawPath(
            blade,
            brush = Brush.verticalGradient(
                colors = listOf(Rb.GoldHi, c, Color(0xFF8B6314)),
                startY = tip.y, endY = bladeBottom,
            ),
        )
        drawPath(blade, color = c, style = Stroke(width = 2f))

        // Mirror-symmetry preview: a ghosted double-edge outline over the blade.
        if (t?.mirror == true) {
            scale(scaleX = -1f, scaleY = 1f, pivot = Offset(heel.x, bladeBottom)) {
                drawPath(blade, color = Rb.Purple.copy(alpha = 0.5f), style = Stroke(width = 3f))
            }
        }

        // Grain — literally the route, drawn down the middle of the steel.
        val grain = Path().apply {
            if (spine == null) {
                moveTo(cx, bladeTop)
                cubicTo(cx + 8f, (bladeTop + bladeBottom) * 0.4f, cx - 8f, (bladeTop + bladeBottom) * 0.6f, cx, bladeBottom)
            } else {
                spine.forEachIndexed { i, p -> if (i == 0) moveTo(p.x, p.y) else lineTo(p.x, p.y) }
            }
        }
        drawPath(grain, color = Rb.GoldHi.copy(alpha = 0.55f), style = Stroke(width = 3f))

        // Guard and handle hang off the heel — where the run started — so a route that finishes
        // off to one side still has its hilt attached to the blade.
        val hiltX = heel.x
        drawRoundRect(
            color = Rb.Blue,
            topLeft = Offset(hiltX - bladeW * 1.15f, bladeBottom),
            size = androidx.compose.ui.geometry.Size(bladeW * 2.3f, h * 0.035f),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(6f, 6f),
        )
        drawRoundRect(
            color = Rb.Surface4,
            topLeft = Offset(hiltX - 7f, bladeBottom + h * 0.035f),
            size = androidx.compose.ui.geometry.Size(14f, h * 0.16f),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(7f, 7f),
        )
        // pommel + tip
        drawCircle(Color(0xFF4A5260), radius = 9f, center = Offset(hiltX, bladeBottom + h * 0.20f))
        drawCircle(Rb.GoldHi, radius = 6f, center = tip)
    }
}
