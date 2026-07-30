package app.hitrace.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.AppViewModel
import app.hitrace.data.ApiClient
import app.hitrace.data.Balance
import app.hitrace.data.MeResp
import app.hitrace.data.Sword
import app.hitrace.data.UpgradeBody
import app.hitrace.ui.theme.Rb
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/** Demo weekly running total that drives the runner bonus (matches the web client). */
private const val WEEKLY_KM = 18.6

@Composable
fun UpgradeScreen(vm: AppViewModel, me: MeResp, swordId: String, onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    var sword by remember { mutableStateOf<Sword?>(null) }
    var reload by remember { mutableIntStateOf(0) }
    var busy by remember { mutableStateOf(false) }
    var flash by remember { mutableStateOf<Pair<Boolean, String>?>(null) }

    LaunchedEffect(swordId, reload) {
        sword = runCatching { ApiClient.api.sword(swordId) }.getOrNull()
    }

    val s = sword
    if (s == null) {
        Box(Modifier.fillMaxSize().background(Rb.Bg), contentAlignment = Alignment.Center) {
            Text("강화대 준비 중…", color = Rb.Muted, fontSize = 13.sp)
        }
        return
    }

    val streak = me.user.streakDays
    val cost = Balance.upgradeCost(s.plus)
    val chance = Balance.upgradeSuccessChance(s.plus, WEEKLY_KM, streak)
    val next = Balance.applyUpgrade(s.stats)
    val ore = me.wallet.ore
    val canAfford = ore >= cost

    Column(
        Modifier.fillMaxSize().background(Rb.Bg).verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        ScreenHeader("검 상세", onBack) { CurrencyPill(Rb.Blue, ore) }

        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            RarityChip(s.rarity, s.plus)
            Spacer(Modifier.size(8.dp))
            Text(s.name, color = Rb.Text, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            Text("+${s.plus} → +${s.plus + 1}", color = Rb.Gold, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
        }

        // ── Stat deltas ─────────────────────────────────────────────────────
        RbCard {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                STAT_META.forEach { m ->
                    val cur = m.pick(s.stats)
                    val nx = m.pick(next)
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text(m.label, color = Rb.Text3, fontSize = 13.sp)
                        Spacer(Modifier.weight(1f))
                        Text("$cur", color = Rb.Text2, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
                        Text("  →  ", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
                        Text("$nx", color = m.color, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
                        Text("  +${nx - cur}", color = Rb.Gold2, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
                    }
                }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("CP", color = Rb.Text3, fontSize = 13.sp)
                    Spacer(Modifier.weight(1f))
                    Text("${s.cp} → ${Balance.computeCp(next)}", color = Rb.Gold, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
                }
            }
        }

        // ── Success chance ──────────────────────────────────────────────────
        RbCard {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("성공 확률", color = Rb.Text3, fontSize = 13.sp)
                    Spacer(Modifier.weight(1f))
                    Text("${(chance * 100).roundToInt()}%", color = Rb.Gold, fontFamily = FontFamily.Monospace, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                }
                Meter(chance.toFloat())
                val streakTail = if (streak >= 2) " · 🔥 연속 ${streak}일 숫돌 +${(Balance.streakBonus(streak) * 100).roundToInt()}%" else ""
                Text(
                    "실패 시 등급 유지, 강화 수치 −1. 이번 주 러닝 ${WEEKLY_KM}km 러너 보정$streakTail 적용 중.",
                    color = Rb.Muted, fontSize = 11.5.sp,
                )
            }
        }

        flash?.let { (ok, text) ->
            Text(
                text,
                color = if (ok) Rb.Gold else Rb.Red,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        RbButton(
            when {
                busy -> "강화 중…"
                canAfford -> "강화하기 · 철광석 $cost"
                else -> "철광석 ${cost - ore} 부족"
            },
            Modifier.fillMaxWidth(),
            enabled = canAfford && !busy,
        ) {
            busy = true
            scope.launch {
                runCatching { ApiClient.api.upgrade(s.id, UpgradeBody(WEEKLY_KM)) }
                    .onSuccess { res ->
                        flash = res.success to if (res.success) "강화 성공! +${res.sword.plus}" else "강화 실패 — 수치 −1"
                        vm.refresh(); reload++
                    }
                    .onFailure { flash = false to "철광석이 부족하거나 오류가 발생했습니다." }
                busy = false
            }
        }
        if (!canAfford) Text("더 달리면 철광석을 모을 수 있어요.", color = Rb.Muted, fontSize = 11.sp)
    }
}
