package app.hitrace.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.AppViewModel
import app.hitrace.data.ApiClient
import app.hitrace.data.MeResp
import app.hitrace.data.Opponent
import app.hitrace.data.PvpSession
import app.hitrace.data.ResolveBody
import app.hitrace.data.tierLabel
import app.hitrace.ui.BladeCanvas
import app.hitrace.ui.theme.Rb
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

private enum class Phase { IDLE, SEARCHING, FOUND, RESOLVING }

@Composable
fun MatchingScreen(vm: AppViewModel, me: MeResp, onBattle: () -> Unit) {
    val scope = rememberCoroutineScope()
    var phase by remember { mutableStateOf(Phase.IDLE) }
    var waitSec by remember { mutableStateOf(0) }
    var band by remember { mutableStateOf(0.08) }
    var opponent by remember { mutableStateOf<Opponent?>(null) }
    var err by remember { mutableStateOf<String?>(null) }

    val equipped = me.equipped

    // Poll the matcher once a second while searching; the server widens the CP band
    // with wait time and eventually falls back to a ghost.
    LaunchedEffect(phase) {
        if (phase != Phase.SEARCHING) return@LaunchedEffect
        var t = 0
        while (phase == Phase.SEARCHING) {
            delay(500)
            t += 1
            waitSec = t
            val res = runCatching { ApiClient.api.match(t) }.getOrNull()
            if (res == null) { err = "매칭 오류"; phase = Phase.IDLE; return@LaunchedEffect }
            band = res.band
            if (res.found && res.opponent != null) {
                opponent = res.opponent
                phase = Phase.FOUND
                return@LaunchedEffect
            }
            if (t > 6) { err = "상대를 찾지 못했습니다. 잠시 후 다시 시도해 주세요."; phase = Phase.IDLE; return@LaunchedEffect }
        }
    }

    Column(
        Modifier.fillMaxSize().background(Rb.Bg).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("랭크전", color = Rb.Text, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            Text("${tierLabel(me.user.rankRp)} · ${me.user.rankRp} RP", color = Rb.Gold, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
        }

        equipped?.let { s ->
            RbCard {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    BladeCanvas(s.shape, s.rarity, glow = s.rarity == "LEGEND", modifier = Modifier.size(56.dp, 130.dp))
                    Spacer(Modifier.size(16.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(s.name, color = Rb.Text, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                        Text("CP ${s.cp}", color = Rb.Gold, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
                    }
                }
            }
        }

        Column(
            Modifier.weight(1f).fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            when (phase) {
                Phase.IDLE -> Text(
                    "비슷한 실력의 상대와\nCP ±8% 밴드로 매칭됩니다",
                    color = Rb.Muted, fontSize = 13.sp, textAlign = TextAlign.Center, lineHeight = 20.sp,
                )
                Phase.SEARCHING -> {
                    CircularProgressIndicator(color = Rb.Gold, modifier = Modifier.size(32.dp))
                    Spacer(Modifier.size(12.dp))
                    Text("탐색 중 · 밴드 ±${(band * 100).roundToInt()}%", color = Rb.Text3, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                    if (waitSec > 4) Text("고스트(기록전)로 폴백 중…", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
                }
                else -> opponent?.let { o ->
                    Text("VS", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                    Spacer(Modifier.size(10.dp))
                    RbCard {
                        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(o.sword.name, color = Rb.Text, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                                Text(o.handle, color = Rb.Text3, fontSize = 12.sp)
                            }
                            Spacer(Modifier.weight(1f))
                            Text("CP ${o.cp}", color = Rb.Blue, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
                        }
                    }
                }
            }
            err?.let {
                Spacer(Modifier.size(12.dp))
                Text(it, color = Rb.Red, fontSize = 12.5.sp, textAlign = TextAlign.Center)
            }
        }

        when (phase) {
            Phase.IDLE -> RbButton("매칭 시작", Modifier.fillMaxWidth(), enabled = equipped != null) {
                err = null; waitSec = 0; phase = Phase.SEARCHING
            }
            Phase.SEARCHING -> RbGhostButton("취소", Modifier.fillMaxWidth()) { phase = Phase.IDLE }
            else -> RbButton(
                if (phase == Phase.RESOLVING) "입장 중…" else "전투 시작",
                Modifier.fillMaxWidth(),
                enabled = phase == Phase.FOUND,
            ) {
                val o = opponent ?: return@RbButton
                phase = Phase.RESOLVING
                scope.launch {
                    runCatching { ApiClient.api.resolve(ResolveBody(o.id)) }
                        .onSuccess {
                            PvpSession.result = it
                            PvpSession.myName = equipped?.name ?: "내 검"
                            phase = Phase.IDLE
                            onBattle()
                        }
                        .onFailure { err = "전투를 시작할 수 없습니다."; phase = Phase.FOUND }
                }
            }
        }
        if (equipped == null) Text("검을 장착해야 랭크전에 참여할 수 있습니다.", color = Rb.Muted, fontSize = 11.sp)
    }
}
