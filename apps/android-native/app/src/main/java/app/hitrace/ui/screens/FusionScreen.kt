package app.hitrace.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.AppViewModel
import app.hitrace.data.ApiClient
import app.hitrace.data.Balance
import app.hitrace.data.FusionBody
import app.hitrace.data.MeResp
import app.hitrace.data.Sword
import app.hitrace.data.canFuse
import app.hitrace.data.previewFusion
import app.hitrace.ui.BladeCanvas
import app.hitrace.ui.theme.Rb
import kotlinx.coroutines.launch

/** 합주조 — fuse two SR+ swords into one (CP-weighted average −10%); both parents are consumed. */
@Composable
fun FusionScreen(vm: AppViewModel, me: MeResp, onBack: () -> Unit, onFused: (String) -> Unit) {
    val scope = rememberCoroutineScope()
    var swords by remember { mutableStateOf<List<Sword>>(emptyList()) }
    var reload by remember { mutableIntStateOf(0) }
    val picked = remember { mutableStateListOf<String>() }
    var busy by remember { mutableStateOf(false) }
    var err by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(reload) {
        swords = runCatching { ApiClient.api.swords() }.getOrNull().orEmpty()
    }

    val candidates = swords.filter { it.rarity == "SR" || it.rarity == "LEGEND" }
    val a = swords.firstOrNull { it.id == picked.getOrNull(0) }
    val b = swords.firstOrNull { it.id == picked.getOrNull(1) }
    val equippedId = me.user.equippedSwordId
    val ready = a != null && b != null && canFuse(a, b) && a.id != equippedId && b.id != equippedId

    Column(
        Modifier.fillMaxSize().background(Rb.Bg).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        ScreenHeader("보관함", onBack) {
            Text("SR 이상 2자루", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
        }
        Text("합주조", color = Rb.Text, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)

        if (candidates.size < 2) {
            Text("합주조에는 SR 이상 검이 2자루 필요합니다.", color = Rb.Text3, fontSize = 13.sp)
        }

        LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            items(candidates) { s ->
                val idx = picked.indexOf(s.id)
                val isEquipped = s.id == equippedId
                Column(
                    Modifier.size(110.dp, 190.dp).clip(RoundedCornerShape(14.dp)).background(Rb.Surface2)
                        .border(
                            1.dp,
                            if (idx >= 0) Rb.Gold.copy(alpha = 0.6f) else Rb.Line,
                            RoundedCornerShape(14.dp),
                        )
                        .clickable(enabled = !isEquipped) {
                            when {
                                idx >= 0 -> picked.removeAt(idx)
                                picked.size < 2 -> picked.add(s.id)
                                else -> { picked.removeAt(0); picked.add(s.id) }
                            }
                            err = null
                        }
                        .padding(8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    BladeCanvas(s.shape, s.rarity, modifier = Modifier.size(40.dp, 100.dp))
                    Text(s.name, color = if (isEquipped) Rb.Muted else Rb.Text, fontSize = 11.sp, maxLines = 1)
                    Text(
                        if (isEquipped) "장착 중" else "CP ${s.cp}",
                        color = if (idx >= 0) Rb.Gold else Rb.Muted,
                        fontFamily = FontFamily.Monospace, fontSize = 10.sp,
                    )
                }
            }
        }

        // Live preview of the fused result
        if (a != null && b != null) {
            val next = previewFusion(a, b)
            RbCard {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text("합주조 결과 미리보기", color = Rb.Text3, fontSize = 13.sp)
                        Spacer(Modifier.weight(1f))
                        Text("CP ${Balance.computeCp(next)}", color = Rb.Gold, fontFamily = FontFamily.Monospace, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    }
                    STAT_META.forEach { m ->
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Text(m.label, color = Rb.Text3, fontSize = 12.sp)
                            Spacer(Modifier.weight(1f))
                            Text(
                                "${m.pick(a.stats)} + ${m.pick(b.stats)} → ${m.pick(next)}",
                                color = m.color, fontFamily = FontFamily.Monospace, fontSize = 12.sp,
                            )
                        }
                    }
                    Text("가중 평균에서 −10%. 두 검은 소멸하고 각인 1개가 계승됩니다.", color = Rb.Muted, fontSize = 11.sp)
                }
            }
        } else {
            Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                Text("합칠 두 자루를 선택하세요", color = Rb.Muted, fontSize = 13.sp)
            }
        }

        err?.let { Text(it, color = Rb.Red, fontSize = 12.5.sp) }
        Spacer(Modifier.weight(1f))

        RbButton(if (busy) "주조 중…" else "합주조 실행", Modifier.fillMaxWidth(), enabled = ready && !busy) {
            busy = true
            scope.launch {
                runCatching { ApiClient.api.fusion(FusionBody(listOf(picked[0], picked[1]))) }
                    .onSuccess { res ->
                        picked.clear(); reload++
                        vm.refresh()
                        onFused(res.sword.id)
                    }
                    .onFailure { err = "합주조에 실패했습니다 (장착 중이거나 SR 미만)." }
                busy = false
            }
        }
        if (a != null && (a.id == equippedId || b?.id == equippedId)) {
            Text("장착 중인 검은 합주조할 수 없습니다.", color = Rb.Muted, fontSize = 11.sp)
        }
    }
}
