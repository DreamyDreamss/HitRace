package app.hitrace.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// ── Design tokens — lifted from the HitRace spec (docs/DESIGN_TOKENS.md) ──
object Rb {
    val Bg = Color(0xFF08090B)
    val Screen = Color(0xFF0B0C0E)
    val Deep = Color(0xFF0E1014)
    val Surface = Color(0xFF12141A)
    val Surface2 = Color(0xFF14161B)
    val Surface3 = Color(0xFF1B1E25)
    val Surface4 = Color(0xFF282C34)
    val Line = Color(0x14FFFFFF)
    val Text = Color(0xFFF2F3F5)
    val Text2 = Color(0xFFC6CBD3)
    val Text3 = Color(0xFF9AA1AC)
    val Muted = Color(0xFF5E656F)
    val Gold = Color(0xFFD9A227)
    val Gold2 = Color(0xFFE8C56A)
    val GoldHi = Color(0xFFFFE9B0)
    val Blue = Color(0xFF8FA6C4)
    val Purple = Color(0xFFB48CF0)
    val Red = Color(0xFFE85A3C)
    val Green = Color(0xFF7FB98A)

    fun rarityColor(r: String): Color = when (r) {
        "LEGEND" -> Gold
        "SR" -> Purple
        "R" -> Blue
        else -> Muted
    }
}

private val RbColors = darkColorScheme(
    primary = Rb.Gold,
    onPrimary = Rb.Screen,
    background = Rb.Bg,
    onBackground = Rb.Text,
    surface = Rb.Surface2,
    onSurface = Rb.Text,
)

// System-font stack (no bundled webfont). Mono role carried by monospace.
val RbType = Typography(
    displayLarge = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 30.sp),
    headlineMedium = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 22.sp),
    titleMedium = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 17.sp),
    bodyMedium = TextStyle(fontSize = 14.sp),
    labelSmall = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 11.sp, letterSpacing = 1.6.sp),
)

@Composable
fun HitRaceTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = RbColors, typography = RbType, content = content)
}
