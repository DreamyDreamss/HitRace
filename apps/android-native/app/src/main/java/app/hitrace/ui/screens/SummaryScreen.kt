package app.hitrace.ui.screens

import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.AuthState
import app.hitrace.AppViewModel
import app.hitrace.data.ApiClient
import app.hitrace.data.Balance
import app.hitrace.data.RunBody
import app.hitrace.data.RunMath
import app.hitrace.data.PendingRunStore
import app.hitrace.data.RunSession
import app.hitrace.data.apiFailure
import app.hitrace.ui.RouteTrace
import app.hitrace.ui.theme.Rb
import kotlinx.coroutines.launch

@Composable
fun SummaryScreen(vm: AppViewModel, onForged: () -> Unit, onSavedOnly: () -> Unit) {
    val track = RunSession.track
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var err by remember { mutableStateOf<String?>(null) }
    var queued by remember { mutableStateOf(false) }
    val ctx = LocalContext.current

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
                    RunSession.weeklyGoal = res.weeklyGoal
                    if (forge && res.sword != null) { RunSession.forged = res.sword; onForged() } else onSavedOnly()
                }
                .onFailure { t ->
                    val f = t.apiFailure()
                    when {
                        f?.status == 429 -> err = "오늘 주조 한도(2자루)를 모두 사용했어요."
                        f?.status == 422 -> err = rejectionMessage(f.reasons)
                        // No answer from the server means the run isn't rejected — it just
                        // hasn't arrived. Losing an hour of running to a dead signal is not
                        // acceptable, so it goes on disk and uploads itself later.
                        f == null -> {
                            PendingRunStore.of(ctx).add(RunBody(track, forge))
                            vm.notePendingRuns()
                            queued = true
                        }
                        else -> err = "문제가 발생했습니다. 다시 시도해 주세요."
                    }
                    busy = false
                }
        }
    }

    // The forge budget is known up front, so the button can say why it is unavailable
    // instead of failing on tap.
    val budget = (vm.auth.collectAsState().value as? AuthState.LoggedIn)?.me?.forge
    val capReached = budget?.exhausted == true

    // The minimums are known here, so say so up front rather than letting the tap fail.
    // Saving the record is still allowed — a short walk is something that happened.
    val shortDistance = m.distanceKm < Balance.MIN_DISTANCE_KM
    val shortDuration = m.durationSec < Balance.MIN_DURATION_SEC
    val tooShort = shortDistance || shortDuration

    Column(
        Modifier.fillMaxSize().background(Rb.Bg).verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
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
        // How the run was paced decides the sword's 마력. Shown here, before forging, because
        // that is the only moment it can still change how someone runs tomorrow.
        val finish = remember(track.points) { RunMath.finishingPower(track.points) }
        Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Rb.Surface2).border(1.dp, Rb.Line, RoundedCornerShape(14.dp)).padding(14.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("후반 구간력", color = Rb.Text3, fontSize = 13.sp, modifier = Modifier.weight(1f))
                    Text(
                        RunMath.finishingLabel(finish),
                        color = if (finish >= 0.58) Rb.Purple else if (finish > 0.42) Rb.Text2 else Rb.Muted,
                        fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                    )
                }
                Meter(finish.toFloat(), Rb.Purple, Modifier.fillMaxWidth())
                Text("검의 마력이 됩니다 — 후반을 전반보다 빠르게 달릴수록 높아집니다.", color = Rb.Muted, fontSize = 11.sp)
            }
        }
        Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Rb.Gold.copy(alpha = 0.1f)).border(1.dp, Rb.Gold.copy(alpha = 0.35f), RoundedCornerShape(14.dp)).padding(14.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("획득 예정", color = Rb.Gold2, fontSize = 13.sp, modifier = Modifier.weight(1f))
                Text("철광석 ${RunMath.oreReward(m.distanceKm)}" + if (RunMath.ticketReward(m.distanceKm) > 0) " · 티켓 1" else "", color = Rb.Gold2, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
            }
        }
        if (err != null) Text(err!!, color = Rb.Red, fontSize = 12.5.sp)
        if (queued) {
            Box(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Rb.Surface2)
                    .border(1.dp, Rb.Line, RoundedCornerShape(14.dp)).padding(14.dp),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("기기에 저장했습니다", color = Rb.Text, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    Text(
                        "서버에 연결되지 않아 이 러닝을 폰에 보관했습니다. 연결되면 자동으로 전송되고, " +
                            "그때 검도 함께 주조됩니다.",
                        color = Rb.Text3, fontSize = 12.sp,
                    )
                }
            }
        }
        budget?.takeIf { !it.exhausted }?.let {
            Text("오늘 주조 ${it.today}/${it.max}", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
        }
        if (capReached) {
            Text(
                "오늘 주조 한도(${budget?.max ?: 2}자루)를 모두 썼습니다 — 기록은 그대로 저장됩니다.",
                color = Rb.Text3, fontSize = 12.5.sp,
            )
        }
        if (tooShort && !capReached) {
            val missing = listOfNotNull(
                if (shortDistance) "%.2fkm / 1.00km".format(m.distanceKm) else null,
                if (shortDuration) "${(m.durationSec / 60).toInt()}분 / 10분" else null,
            ).joinToString(" · ")
            Text(
                "주조하려면 1km·10분이 필요합니다 ($missing). 기록은 저장할 수 있고, " +
                    "보상은 붙지 않습니다.",
                color = Rb.Text3, fontSize = 12.5.sp,
            )
        }
        Spacer(Modifier.height(4.dp))
        if (queued) {
            // Nothing more to decide here — the run is safe and the choice is already recorded.
            Button(
                onClick = onSavedOnly,
                modifier = Modifier.fillMaxWidth().height(54.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Rb.Gold, contentColor = Rb.Screen),
            ) { Text("확인", fontWeight = FontWeight.Bold, fontSize = 16.sp) }
            Spacer(Modifier.height(8.dp))
            return@Column
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedBtn("기록만 저장", Modifier.weight(1f)) { if (!busy) submit(false) }
            Button(
                onClick = { if (!busy && !capReached && !tooShort) submit(true) },
                enabled = !busy && !capReached && !tooShort,
                modifier = Modifier.weight(1.6f).height(54.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Rb.Gold, contentColor = Rb.Screen,
                    disabledContainerColor = Rb.Surface3, disabledContentColor = Rb.Muted,
                ),
            ) {
                Text(
                    when {
                        busy -> "주조 중…"
                        capReached -> "내일 다시 주조"
                        tooShort -> "1km·10분 필요"
                        else -> "검 주조하기"
                    },
                    fontWeight = FontWeight.Bold, fontSize = 16.sp,
                )
            }
        }
        Spacer(Modifier.height(8.dp))
    }
}

/** Say what actually went wrong, and what to do about it — "조건 미충족" tells nobody anything. */
private fun rejectionMessage(reasons: List<String>): String = when {
    reasons.isEmpty() -> "이 러닝은 저장할 수 없습니다."
    "gps_jump" in reasons ->
        "GPS 신호가 크게 튀어 경로를 신뢰할 수 없습니다. 실내·터널·건물 사이에서 자주 발생해요 — " +
            "하늘이 트인 곳에서 다시 시도하거나, 실내 러닝으로 기록해 주세요."
    "vehicle_suspected" in reasons -> "이동 속도가 달리기 범위를 벗어났습니다 (탈것으로 판정)."
    "pace_too_fast" in reasons -> "평균 페이스가 3'00\"/km보다 빨라 기록으로 인정되지 않습니다."
    "below_min_distance" in reasons && "below_min_duration" in reasons -> "최소 1km·10분을 채워야 합니다."
    "below_min_distance" in reasons -> "최소 1km를 달려야 합니다."
    "below_min_duration" in reasons -> "최소 10분을 달려야 합니다."
    "too_few_points" in reasons -> "위치 기록이 부족합니다. 위치 권한을 확인해 주세요."
    "non_monotonic_time" in reasons -> "기록 시간이 뒤엉켰습니다. 다시 시도해 주세요."
    else -> "이 러닝은 저장할 수 없습니다. (${reasons.joinToString(", ")})"
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
