package app.hitrace.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.AppViewModel
import app.hitrace.data.MeResp
import app.hitrace.ui.theme.Rb

private val TIERS = listOf("Iron", "Bronze", "Silver", "Gold", "Platinum", "Legend")
private fun tierOf(rp: Int): Pair<String, String> {
    val steps = (rp / 100).coerceAtLeast(0)
    val idx = (steps / 4).coerceAtMost(TIERS.size - 1)
    val step = 4 - (steps % 4)
    return TIERS[idx] to "${TIERS[idx][0]}$step"
}

@Composable
fun RankingScreen(vm: AppViewModel, me: MeResp) {
    val ranking by vm.ranking.collectAsState()
    val (tierName, label) = tierOf(me.user.rankRp)
    Column(Modifier.fillMaxSize().background(Rb.Bg).verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("SEASON 3", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp, letterSpacing = 2.sp)
        Text("랭킹", color = Rb.Text, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)

        Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Rb.Surface2).border(1.dp, Rb.Line, RoundedCornerShape(14.dp)).padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("내 티어", color = Rb.Muted, fontSize = 12.sp)
                    Text("$tierName · $label", color = Rb.Gold, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                }
                Text("${me.user.rankRp} RP", color = Rb.Text2, fontFamily = FontFamily.Monospace, fontSize = 14.sp)
            }
        }

        // tier ladder
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            TIERS.forEach { t ->
                val active = t == tierName
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)).background(if (active) Rb.Gold else Rb.Surface4)) {}
                    Text(t, color = if (active) Rb.Gold else Rb.Muted, fontSize = 9.sp, modifier = Modifier.padding(top = 4.dp))
                }
            }
        }

        Text("상위 러너", color = Rb.Text, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 4.dp))
        Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Rb.Surface2).border(1.dp, Rb.Line, RoundedCornerShape(14.dp)).padding(vertical = 4.dp)) {
            Column {
                ranking.forEach { r ->
                    Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("${r.rank}", color = if (r.rank <= 3) Rb.Gold else Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 13.sp, modifier = Modifier.width(28.dp))
                        Text(r.handle, color = Rb.Text, fontSize = 14.sp, modifier = Modifier.weight(1f))
                        Text("CP ${r.cp}", color = Rb.Text3, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                        Spacer(Modifier.width(10.dp))
                        Text("${r.rankRp} RP", color = Rb.Blue, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}
