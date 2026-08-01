package app.hitrace.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.ui.theme.Rb

/**
 * 속성 — the weather a run happened in.
 *
 * Shown as the character plus the kind of day that earns it, because a bare 炎 is a rune nobody
 * can act on. "맑고 더운 날" tells a runner when to go out for one.
 */
fun elementLabel(element: String): String = when (element) {
    "fire" -> "炎"
    "water" -> "水"
    "wind" -> "風"
    "ice" -> "氷"
    else -> "無"
}

fun elementWeather(element: String): String = when (element) {
    "fire" -> "맑고 더운 날"
    "water" -> "비·눈 오는 날"
    "wind" -> "바람 센 날"
    "ice" -> "추운 날"
    else -> "평범한 날씨"
}

fun elementColor(element: String): Color = when (element) {
    "fire" -> Rb.Red
    "water" -> Rb.Blue
    "wind" -> Rb.Green
    "ice" -> Rb.Purple
    else -> Rb.Muted
}

/** What this element does to [against]; null when neither of them has one. */
fun elementMatchup(element: String, against: String): String? {
    if (element == "none" || against == "none") return null
    val beats = mapOf("fire" to "ice", "ice" to "wind", "wind" to "water", "water" to "fire")
    return when {
        beats[element] == against -> "strong"
        beats[against] == element -> "weak"
        else -> "even"
    }
}

@Composable
fun ElementChip(element: String, modifier: Modifier = Modifier, showWeather: Boolean = false) {
    if (element == "none" && !showWeather) return
    val tone = elementColor(element)
    Text(
        if (showWeather) "${elementLabel(element)} · ${elementWeather(element)}" else elementLabel(element),
        color = tone,
        fontSize = if (showWeather) 11.sp else 12.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(tone.copy(alpha = 0.14f))
            .padding(horizontal = 8.dp, vertical = 3.dp),
    )
}
