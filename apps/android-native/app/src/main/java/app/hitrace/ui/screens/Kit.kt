package app.hitrace.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.data.Stats
import app.hitrace.ui.theme.Rb

/** Shared bits used by the stack screens (detail / upgrade / gacha). */

@Composable
fun ScreenHeader(back: String, onBack: () -> Unit, right: @Composable () -> Unit = {}) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        LinkText("‹ $back", onClick = onBack, color = Rb.Muted)
        Spacer(Modifier.weight(1f))
        right()
    }
}

/**
 * A tappable text link. Announced as a button by TalkBack and padded out to a 48dp
 * touch target — a bare clickable Text is neither.
 */
@Composable
fun LinkText(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    color: Color = Rb.Blue,
    fontSize: androidx.compose.ui.unit.TextUnit = 15.sp,
) {
    Box(
        modifier
            .heightIn(min = 48.dp)
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onClick, role = Role.Button)
            .padding(horizontal = 4.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, color = color, fontSize = fontSize, maxLines = 1)
    }
}

@Composable
fun RbButton(
    text: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    tone: Color = Rb.Gold,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.height(52.dp),
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = tone,
            contentColor = Rb.Screen,
            disabledContainerColor = Rb.Surface3,
            disabledContentColor = Rb.Muted,
        ),
    ) { Text(text, fontWeight = FontWeight.Bold, fontSize = 15.sp, maxLines = 1) }
}

@Composable
fun RbGhostButton(
    text: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    tone: Color = Rb.Text2,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.height(52.dp),
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = Rb.Surface3,
            contentColor = tone,
            disabledContainerColor = Rb.Surface2,
            disabledContentColor = Rb.Muted,
        ),
    ) { Text(text, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, maxLines = 1) }
}

@Composable
fun RbCard(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Box(
        modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Rb.Surface2)
            .border(1.dp, Rb.Line, RoundedCornerShape(14.dp)),
    ) { content() }
}

@Composable
fun Eyebrow(text: String) =
    Text(text, color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp, letterSpacing = 2.sp)

/** Horizontal meter used for pity / success-chance bars. */
@Composable
fun Meter(fraction: Float, tone: Color = Rb.Gold, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)).background(Rb.Surface4)) {
        Box(Modifier.fillMaxWidth(fraction.coerceIn(0f, 1f)).height(6.dp).clip(RoundedCornerShape(3.dp)).background(tone))
    }
}

/** [source] is what the runner did to earn it — a stat nobody can trace back is just a number. */
class StatMeta(val label: String, val source: String, val color: Color, val pick: (Stats) -> Int)

val STAT_META = listOf(
    StatMeta("예리함", "페이스", Rb.Gold) { it.sharpness },
    StatMeta("중량", "고도 상승", Rb.Blue) { it.weight },
    StatMeta("내구", "케이던스 일정함", Rb.Text2) { it.durability },
    StatMeta("마력", "후반 구간력", Rb.Purple) { it.magic },
)

@Composable
fun StatBarsCard(stats: Stats) {
    RbCard {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            STAT_META.forEach { m ->
                val label = m.label
                val color = m.color
                val v = m.pick(stats)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.width(58.dp)) {
                        Text(label, color = Rb.Text3, fontSize = 12.sp)
                        Text(m.source, color = Rb.Muted, fontSize = 9.sp)
                    }
                    Meter(v / 900f, color, Modifier.weight(1f))
                    Spacer(Modifier.size(10.dp))
                    Text("$v", color = Rb.Text2, fontFamily = FontFamily.Monospace, fontSize = 12.sp, modifier = Modifier.width(40.dp))
                }
            }
        }
    }
}
