package app.hitrace.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import app.hitrace.data.Sword
import app.hitrace.data.tierLabel
import app.hitrace.ui.BladeCanvas
import app.hitrace.ui.theme.Rb

@Composable
fun HomeScreen(vm: AppViewModel, me: MeResp, onStartRun: () -> Unit = {}, onGacha: () -> Unit = {}) {
    val ranking by vm.ranking.collectAsState()
    val sc = rememberScrollState()
    Column(
        Modifier.fillMaxSize().background(Rb.Bg).verticalScroll(sc).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        // Header
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("시즌 3 · D-24", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp, letterSpacing = 2.sp)
                Text("대장간", color = Rb.Text, fontSize = 24.sp, fontWeight = FontWeight.SemiBold)
            }
            CurrencyPill(Rb.Blue, me.wallet.ore)
            Spacer(Modifier.width(6.dp))
            CurrencyPill(Rb.Gold, me.wallet.forgeTicket)
        }

        me.equipped?.let { EquippedCard(it) }

        // Stat row
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            StatCard(Modifier.weight(1f), "연속 러닝", "${me.user.streakDays}", "일", accent = true)
            StatCard(Modifier.weight(1f), "주조한 검", "${me.swordCount}", null)
            StatCard(Modifier.weight(1f), "랭크", tierLabel(me.user.rankRp), null)
        }
        if (me.user.streakDays >= 2) {
            Text("🔥 숫돌 연마 +${minOf(7, me.user.streakDays)}% 강화 성공률 · 오늘도 달리면 이어집니다",
                color = Rb.Text3, fontSize = 12.sp)
        }

        // Daily quest
        Text("TODAY", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp, letterSpacing = 2.sp)
        Card {
            Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("평균 페이스 5'30\" 이하로 5km", color = Rb.Text, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                    Text("예리함 보너스 ×1.2", color = Rb.Text3, fontSize = 12.sp)
                }
                Text("+300", color = Rb.Gold2, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
            }
        }

        // Ranking
        Text("코스 라이벌", color = Rb.Text, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
        Card {
            Column {
                ranking.take(3).forEach { r ->
                    Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("${r.rank}", color = if (r.rank <= 3) Rb.Gold else Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 13.sp, modifier = Modifier.width(24.dp))
                        Text(r.handle, color = Rb.Text, fontSize = 14.sp, modifier = Modifier.weight(1f))
                        Text("CP ${r.cp}", color = Rb.Text3, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                    }
                }
            }
        }
        androidx.compose.material3.Button(
            onClick = onStartRun,
            modifier = Modifier.fillMaxWidth().height(54.dp),
            shape = RoundedCornerShape(16.dp),
            colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = Rb.Gold, contentColor = Rb.Screen),
        ) { Text("러닝 시작", fontWeight = FontWeight.Bold, fontSize = 16.sp) }
        RbGhostButton("주조 광맥 · 티켓 ${me.wallet.forgeTicket}", Modifier.fillMaxWidth(), onClick = onGacha)
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun EquippedCard(s: Sword) {
    Card {
        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            BladeCanvas(s.shape, s.rarity, glow = s.rarity == "LEGEND", modifier = Modifier.size(72.dp, 168.dp))
            Spacer(Modifier.width(16.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RarityChip(s.rarity, s.plus)
                    if (s.shape.trueDoubleEdge) {
                        Spacer(Modifier.width(8.dp))
                        Text("眞 양날", color = Rb.Gold2, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
                    }
                }
                Text(s.name, color = Rb.Text, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    StatMini("예리", s.stats.sharpness); StatMini("중량", s.stats.weight)
                    StatMini("내구", s.stats.durability); StatMini("마력", s.stats.magic)
                }
            }
        }
    }
}

@Composable private fun StatMini(k: String, v: Int) = Column {
    Text(k, color = Rb.Muted, fontSize = 10.sp)
    Text("$v", color = Rb.Text2, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
}

@Composable
fun Card(content: @Composable () -> Unit) {
    androidx.compose.foundation.layout.Box(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Rb.Surface2).border(1.dp, Rb.Line, RoundedCornerShape(14.dp)),
    ) { content() }
}

@Composable
fun CurrencyPill(dot: androidx.compose.ui.graphics.Color, value: Int) {
    Row(
        Modifier.clip(RoundedCornerShape(999.dp)).background(Rb.Surface3).border(1.dp, Rb.Line, RoundedCornerShape(999.dp)).padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        androidx.compose.foundation.layout.Box(Modifier.size(8.dp).clip(RoundedCornerShape(4.dp)).background(dot))
        Spacer(Modifier.width(6.dp))
        Text("$value", color = Rb.Text2, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
    }
}

@Composable
fun RarityChip(rarity: String, plus: Int) {
    val c = Rb.rarityColor(rarity)
    androidx.compose.foundation.layout.Box(
        Modifier.clip(RoundedCornerShape(6.dp)).background(c.copy(alpha = 0.13f)).border(1.dp, c.copy(alpha = 0.33f), RoundedCornerShape(6.dp)).padding(horizontal = 8.dp, vertical = 3.dp),
    ) {
        Text(if (plus > 0) "$rarity · +$plus" else rarity, color = c, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
    }
}

@Composable
fun StatCard(modifier: Modifier, label: String, value: String, unit: String?, accent: Boolean = false) {
    androidx.compose.foundation.layout.Box(
        modifier.clip(RoundedCornerShape(12.dp)).background(Rb.Surface2).border(1.dp, Rb.Line, RoundedCornerShape(12.dp)).padding(14.dp),
    ) {
        Column {
            Text(label, color = Rb.Muted, fontSize = 11.sp)
            Row(verticalAlignment = Alignment.Bottom) {
                Text(value, color = if (accent) Rb.Gold else Rb.Text, fontFamily = FontFamily.Monospace, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                if (unit != null) Text(unit, color = Rb.Muted, fontSize = 11.sp, modifier = Modifier.padding(start = 2.dp, bottom = 3.dp))
            }
        }
    }
}
