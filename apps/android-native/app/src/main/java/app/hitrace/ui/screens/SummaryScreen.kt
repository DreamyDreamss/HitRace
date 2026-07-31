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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.AppViewModel
import app.hitrace.data.ApiClient
import app.hitrace.data.RunBody
import app.hitrace.data.RunMath
import app.hitrace.data.RunSession
import app.hitrace.ui.RouteTrace
import app.hitrace.ui.theme.Rb
import kotlinx.coroutines.launch

@Composable
fun SummaryScreen(vm: AppViewModel, onForged: () -> Unit, onSavedOnly: () -> Unit) {
    val track = RunSession.track
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var err by remember { mutableStateOf<String?>(null) }

    if (track == null || track.points.size < 2) {
        Column(Modifier.fillMaxSize().background(Rb.Bg), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Text("표시할 러닝이 없습니다.", color = Rb.Text3, fontSize = 14.sp)
        }
        return
    }
    val m = RunMath.metrics(track.points)
    val score = RunMath.score(m)

    fun submit(forge: Boolean) {
        busy = true; err = null
        scope.launch {
            runCatching { ApiClient.api.submitRun(RunBody(track, forge)) }
                .onSuccess { res ->
                    vm.refresh()
                    RunSession.records = res.records
                    if (forge && res.sword != null) { RunSession.forged = res.sword; onForged() } else onSavedOnly()
                }
                .onFailure {
                    err = when {
                        it.message?.contains("429") == true -> "오늘 주조 한도(2자루)를 모두 사용했어요."
                        it.message?.contains("422") == true -> "주조 조건 미충족 (최소 1km·10분)."
                        else -> "문제가 발생했습니다. 다시 시도해 주세요."
                    }
                    busy = false
                }
        }
    }

    Column(Modifier.fillMaxSize().background(Rb.Bg).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("러닝 완료", color = Rb.Text, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            RarityChip(score.rarity, 0)
        }
        Box(Modifier.fillMaxWidth().height(180.dp).clip(RoundedCornerShape(16.dp)).border(1.dp, Rb.Line, RoundedCornerShape(16.dp))) {
            RouteTrace(track.points, Modifier.fillMaxSize())
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Mini(Modifier.weight(1f), "거리", "%.2f".format(m.distanceKm), "km")
            Mini(Modifier.weight(1f), "페이스", RunMath.paceLabel(m.paceSecPerKm), null, accent = true)
            Mini(Modifier.weight(1f), "고도", "${m.elevationM.toInt()}", "m")
        }
        Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Rb.Surface2).border(1.dp, Rb.Line, RoundedCornerShape(14.dp)).padding(16.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
                    Text("주조 스코어", color = Rb.Text, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                    Text("${score.total} · ${score.rarity}", color = Rb.Purple, fontFamily = FontFamily.Monospace, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                }
                ScoreRow("기본 (거리·시간)", score.base)
                ScoreRow("페이스 보너스", score.pace)
                ScoreRow("신규 코스 탐험", score.explore)
                ScoreRow("고도 보너스", score.elev)
            }
        }
        Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Rb.Gold.copy(alpha = 0.1f)).border(1.dp, Rb.Gold.copy(alpha = 0.35f), RoundedCornerShape(14.dp)).padding(14.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("획득 예정", color = Rb.Gold2, fontSize = 13.sp, modifier = Modifier.weight(1f))
                Text("철광석 ${RunMath.oreReward(m.distanceKm)}" + if (RunMath.ticketReward(m.distanceKm) > 0) " · 티켓 1" else "", color = Rb.Gold2, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
            }
        }
        if (err != null) Text(err!!, color = Rb.Red, fontSize = 12.5.sp)
        Spacer(Modifier.weight(1f))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedBtn("기록만 저장", Modifier.weight(1f)) { if (!busy) submit(false) }
            Button(onClick = { if (!busy) submit(true) }, modifier = Modifier.weight(1.6f).height(54.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = Rb.Gold, contentColor = Rb.Screen)) {
                Text(if (busy) "주조 중…" else "검 주조하기", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        }
    }
}

@Composable
private fun ScoreRow(label: String, v: Int) = Row(Modifier.fillMaxWidth()) {
    Text(label, color = Rb.Text3, fontSize = 12.sp, modifier = Modifier.weight(1f))
    Text(if (v > 0) "+$v" else "$v", color = if (v > 0) Rb.Gold else Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
}

@Composable
private fun Mini(modifier: Modifier, label: String, value: String, unit: String?, accent: Boolean = false) {
    Box(modifier.clip(RoundedCornerShape(12.dp)).background(Rb.Surface2).border(1.dp, Rb.Line, RoundedCornerShape(12.dp)).padding(10.dp)) {
        Column {
            Text(label, color = Rb.Muted, fontSize = 10.5.sp)
            Row(verticalAlignment = Alignment.Bottom) {
                Text(value, color = if (accent) Rb.Gold else Rb.Text, fontFamily = FontFamily.Monospace, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                if (unit != null) Text(unit, color = Rb.Muted, fontSize = 9.sp)
            }
        }
    }
}
