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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.data.ApiClient
import app.hitrace.data.RewardItem
import app.hitrace.ui.rememberLoad
import app.hitrace.ui.theme.Rb

private val KIND_KO = mapOf(
    "ore" to "철광석", "forgeTicket" to "티켓", "engraveStone" to "각인석", "skin" to "스킨",
)

@Composable
fun SeasonScreen(onBack: () -> Unit) {
    val data = rememberLoad { ApiClient.api.season() }
    if (data == null) {
        Box(Modifier.fillMaxSize().background(Rb.Bg), contentAlignment = Alignment.Center) {
            Text("시즌 불러오는 중…", color = Rb.Muted, fontSize = 13.sp)
        }
        return
    }

    Column(
        Modifier.fillMaxSize().background(Rb.Bg).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        ScreenHeader("프로필", onBack)
        Column {
            Eyebrow("D-${data.season.daysLeft}")
            Text(data.season.name, color = Rb.Text, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
        }

        RbCard {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("패스 레벨", color = Rb.Text3, fontSize = 13.sp)
                    Spacer(Modifier.weight(1f))
                    Text("Lv.${data.pass.level}", color = Rb.Gold, fontFamily = FontFamily.Monospace, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                }
                Meter(data.progress.pct.toFloat())
                Text(
                    "다음 레벨까지 %.1fkm · 러닝 %.1fkm 누적".format(
                        (data.progress.perLevel - data.progress.intoLevel).coerceAtLeast(0.0),
                        data.pass.kmProgress,
                    ),
                    color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp,
                )
            }
        }

        if (!data.pass.isPremium) {
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Rb.Gold.copy(alpha = 0.10f))
                    .border(1.dp, Rb.Gold.copy(alpha = 0.35f), RoundedCornerShape(14.dp))
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text("프리미엄 패스", color = Rb.Gold2, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    Text("스킨 · 칭호 · 티켓 · 스탯 없음", color = Rb.Text3, fontSize = 12.sp)
                }
                Text("₩5,900", color = Rb.Gold, fontFamily = FontFamily.Monospace, fontSize = 14.sp)
            }
        }

        Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp)) {
            Text("레벨", color = Rb.Muted, fontSize = 11.sp, modifier = Modifier.width(44.dp))
            Text("무료", color = Rb.Muted, fontSize = 11.sp, modifier = Modifier.weight(1f))
            Text("프리미엄", color = Rb.Muted, fontSize = 11.sp, modifier = Modifier.weight(1f))
        }
        RbCard(Modifier.weight(1f)) {
            LazyColumn {
                items(data.rewards) { r ->
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp)
                            .alpha(if (r.claimed) 1f else 0.55f),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "${r.level}",
                            color = if (r.claimed) Rb.Gold else Rb.Muted,
                            fontFamily = FontFamily.Monospace, fontSize = 13.sp,
                            modifier = Modifier.width(44.dp),
                        )
                        RewardCell(r.free, Modifier.weight(1f), locked = false)
                        RewardCell(r.premium, Modifier.weight(1f), locked = !data.pass.isPremium)
                    }
                }
            }
        }
    }
}

@Composable
private fun RewardCell(item: RewardItem, modifier: Modifier, locked: Boolean) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Text(
            "${KIND_KO[item.kind] ?: item.kind} ${item.amount}",
            color = if (locked) Rb.Muted else Rb.Text2,
            fontSize = 12.sp,
        )
        if (locked) {
            Spacer(Modifier.width(4.dp))
            Text("🔒", fontSize = 10.sp)
        }
    }
}
