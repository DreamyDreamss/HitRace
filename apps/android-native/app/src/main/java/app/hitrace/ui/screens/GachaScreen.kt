package app.hitrace.ui.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.AppViewModel
import app.hitrace.data.ApiClient
import app.hitrace.data.Balance
import app.hitrace.data.GachaBody
import app.hitrace.data.GachaResp
import app.hitrace.data.MeResp
import app.hitrace.ui.theme.Rb
import kotlinx.coroutines.launch

private data class TierMeta(val ko: String, val color: Color)

private fun tierMeta(tier: String): TierMeta = when (tier) {
    "legendMaterial" -> TierMeta("전설 재료", Rb.Gold)
    "engraveStone" -> TierMeta("각인석", Rb.Purple)
    else -> TierMeta("강화 광석", Rb.Blue)
}

@Composable
fun GachaScreen(vm: AppViewModel, me: MeResp, onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    var result by remember { mutableStateOf<GachaResp?>(null) }
    var busy by remember { mutableStateOf(false) }
    var err by remember { mutableStateOf<String?>(null) }

    val tickets = me.wallet.forgeTicket
    val pity = me.user.gachaPity

    Column(
        Modifier.fillMaxSize().background(Rb.Bg).verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        ScreenHeader("홈", onBack) { CurrencyPill(Rb.Gold, tickets) }
        Column {
            Eyebrow("ORE VEIN")
            Text("주조 광맥", color = Rb.Text, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
        }

        // ── Pity ────────────────────────────────────────────────────────────
        RbCard {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("천장까지", color = Rb.Text3, fontSize = 12.5.sp)
                    Spacer(Modifier.weight(1f))
                    Text("$pity / ${Balance.GACHA_PITY_COUNT}", color = Rb.Gold2, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                }
                Meter(pity.toFloat() / Balance.GACHA_PITY_COUNT)
            }
        }

        // ── Reveal ──────────────────────────────────────────────────────────
        Box(
            Modifier.fillMaxWidth().heightIn(min = 200.dp).clip(RoundedCornerShape(16.dp))
                .background(Rb.Deep).border(1.dp, Rb.Line, RoundedCornerShape(16.dp)).padding(14.dp),
            contentAlignment = Alignment.Center,
        ) {
            val res = result
            if (res == null) {
                Text(
                    "검은 가챠에서 나오지 않습니다 — 재료·각인만.\n검은 오직 달려서.",
                    color = Rb.Muted, fontSize = 13.sp, textAlign = TextAlign.Center, lineHeight = 20.sp,
                )
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(5),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth().heightIn(max = 200.dp),
                    userScrollEnabled = false,
                ) {
                    itemsIndexed(res.pulls) { i, p -> PullCell(i, tierMeta(p.tier), p.pity) }
                }
            }
        }

        result?.grants?.let { g ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                if (g.ore > 0) Text("광석 +${g.ore}", color = Rb.Blue, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                if (g.engraveStone > 0) Text("각인석 +${g.engraveStone}", color = Rb.Purple, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                if (g.legendMaterial > 0) Text("전설재료 +${g.legendMaterial}", color = Rb.Gold, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
            }
        }

        // ── Rates ───────────────────────────────────────────────────────────
        RbCard {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Eyebrow("DROP RATES")
                Balance.GACHA_RATES.forEach { (tier, rate) ->
                    val meta = tierMeta(tier)
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(8.dp).clip(CircleShape).background(meta.color))
                        Spacer(Modifier.size(8.dp))
                        Text(meta.ko, color = Rb.Text2, fontSize = 12.sp)
                        Spacer(Modifier.weight(1f))
                        Text(String.format("%.1f%%", rate * 100), color = Rb.Text3, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                    }
                }
            }
        }

        err?.let { Text(it, color = Rb.Red, fontSize = 12.5.sp) }

        fun pull(count: Int) {
            busy = true; err = null
            scope.launch {
                runCatching { ApiClient.api.gacha(GachaBody(count)) }
                    .onSuccess { result = it; vm.refresh() }
                    .onFailure { err = "주조 티켓이 부족합니다. 3km 이상 달리면 티켓을 받아요." }
                busy = false
            }
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            RbGhostButton("1회 · 티켓 1", Modifier.weight(1f), enabled = tickets >= Balance.GACHA_TICKET_PER_PULL && !busy) { pull(1) }
            RbButton(
                if (busy) "주조 중…" else "10연차 · 티켓 ${Balance.GACHA_TICKET_PER_10}",
                Modifier.weight(1.4f),
                enabled = tickets >= Balance.GACHA_TICKET_PER_10 && !busy,
            ) { pull(10) }
        }
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun PullCell(index: Int, meta: TierMeta, pity: Boolean) {
    val pop = remember { Animatable(0f) }
    androidx.compose.runtime.LaunchedEffect(Unit) {
        kotlinx.coroutines.delay(index * 55L)
        pop.animateTo(1f, androidx.compose.animation.core.tween(220))
    }
    Column(
        Modifier.aspectRatio(1f).clip(RoundedCornerShape(10.dp))
            .background(meta.color.copy(alpha = 0.09f * pop.value))
            .border(1.dp, meta.color.copy(alpha = 0.33f * pop.value), RoundedCornerShape(10.dp)),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(Modifier.size((12 * pop.value).dp).clip(CircleShape).background(meta.color))
        if (pity) Text("천장", color = Rb.Gold, fontFamily = FontFamily.Monospace, fontSize = 8.sp)
    }
}
