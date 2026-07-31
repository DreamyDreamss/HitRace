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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.data.ApiClient
import app.hitrace.data.RunMath
import app.hitrace.data.Split
import app.hitrace.ui.BladeCanvas
import app.hitrace.ui.RouteTrace
import app.hitrace.ui.rememberLoad
import app.hitrace.ui.theme.Rb

/** One run: the route you drew, how each kilometre went, and what it forged. */
@Composable
fun RunDetailScreen(runId: String, onBack: () -> Unit, onSword: (String) -> Unit) {
    val data = rememberLoad(runId) { ApiClient.api.runDetail(runId) }
    if (data == null) {
        Box(Modifier.fillMaxSize().background(Rb.Bg), contentAlignment = Alignment.Center) {
            Text("기록 여는 중…", color = Rb.Muted, fontSize = 13.sp)
        }
        return
    }
    val run = data.run
    // Bars are normalised across the run's own pace range, not against zero: on an even
    // run every km is within a few seconds, and a 0-based scale would draw them identical.
    val paces = data.splits.map { it.paceSecPerKm }.filter { it > 0 }
    val fastest = paces.minOrNull() ?: 0
    val slowest = paces.maxOrNull() ?: 0

    Column(
        Modifier.fillMaxSize().background(Rb.Bg).verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        ScreenHeader("기록", onBack) {
            if (run.isIndoor) Text("실내 러닝", color = Rb.Blue, fontSize = 12.sp)
        }
        Column {
            Text(dayLabel(run.startedAt), color = Rb.Text, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
            Text(timeLabel(run.startedAt) + " 시작", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
        }

        // Route — indoor runs have none, and saying so beats an empty box.
        Box(
            Modifier.fillMaxWidth().height(220.dp).clip(RoundedCornerShape(16.dp))
                .background(Rb.Deep).border(1.dp, Rb.Line, RoundedCornerShape(16.dp)),
        ) {
            if (data.route.size >= 2) {
                RouteTrace(data.route, Modifier.fillMaxSize())
            } else {
                Text(
                    if (run.isIndoor) "실내 러닝 — 경로 기록 없음" else "경로 정보가 없습니다",
                    color = Rb.Muted, fontSize = 13.sp, modifier = Modifier.align(Alignment.Center),
                )
            }
        }

        // Headline numbers
        RbCard {
            Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Big("거리", "%.2f".format(run.distanceKm), "km", Rb.Gold)
                Big("평균 페이스", RunMath.paceLabel(run.avgPaceSecPerKm.toDouble()), "/km", Rb.Text)
                Big("시간", hms(run.durationSec), "", Rb.Text)
                Big("고도", "${run.elevationGainM}", "m", Rb.Text3)
            }
        }

        data.bestKmPaceSecPerKm?.let {
            Text(
                "가장 빠른 1km — ${RunMath.paceLabel(it.toDouble())}",
                color = Rb.Gold2, fontFamily = FontFamily.Monospace, fontSize = 12.sp,
            )
        }

        // Same course, run before? Then the only number that matters is the difference.
        if (!run.isIndoor && data.course.totalRuns > 1) {
            RbCard {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text("같은 코스 ${data.course.attempt}회차", color = Rb.Text2, fontSize = 13.sp)
                        Spacer(Modifier.weight(1f))
                        if (data.course.isCourseBest) {
                            Text(
                                "🏅 코스 최고 기록", color = Rb.Gold, fontSize = 11.sp,
                                modifier = Modifier.clip(RoundedCornerShape(999.dp))
                                    .background(Rb.Gold.copy(alpha = 0.13f))
                                    .padding(horizontal = 10.dp, vertical = 4.dp),
                            )
                        }
                    }
                    data.course.deltaVsPreviousSec?.let { d ->
                        val faster = d < 0
                        Text(
                            when {
                                d == 0 -> "직전과 같은 페이스"
                                faster -> "직전보다 km당 ${-d}초 빨라졌습니다"
                                else -> "직전보다 km당 ${d}초 느렸습니다"
                            },
                            color = if (faster) Rb.Green else Rb.Muted,
                            fontFamily = FontFamily.Monospace, fontSize = 12.sp,
                        )
                    }
                    data.course.bestPaceSecPerKm?.let {
                        Text(
                            "코스 최고 ${RunMath.paceLabel(it.toDouble())} /km",
                            color = Rb.Text3, fontFamily = FontFamily.Monospace, fontSize = 11.sp,
                        )
                    }
                }
            }
        }

        // Splits: bar length is relative to the slowest km, so the shape reads at a glance.
        if (data.splits.isNotEmpty()) {
            Eyebrow("SPLITS")
            RbCard {
                Column(Modifier.padding(vertical = 8.dp)) {
                    data.splits.forEach { s ->
                        SplitRow(
                            s, fastest, slowest,
                            isBest = data.bestKmPaceSecPerKm == s.paceSecPerKm && s.distanceKm >= 0.999,
                        )
                    }
                }
            }
        }

        data.sword?.let { s ->
            Eyebrow("이 러닝이 만든 검")
            RbCard(Modifier.clickable { onSword(s.id) }) {
                Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    BladeCanvas(s.shape, s.rarity, glow = s.rarity == "LEGEND", modifier = Modifier.size(44.dp, 104.dp))
                    Spacer(Modifier.size(14.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        RarityChip(s.rarity, s.plus)
                        Text(s.name, color = Rb.Text, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                        Text("CP ${s.cp}", color = Rb.rarityColor(s.rarity), fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                    }
                }
            }
        }
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun Big(label: String, value: String, unit: String, tone: Color) {
    Column {
        Text(label, color = Rb.Muted, fontSize = 10.sp)
        Row(verticalAlignment = Alignment.Bottom) {
            Text(value, color = tone, fontFamily = FontFamily.Monospace, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
            if (unit.isNotEmpty()) Text(unit, color = Rb.Muted, fontSize = 9.sp, modifier = Modifier.padding(start = 1.dp, bottom = 2.dp))
        }
    }
}

@Composable
private fun SplitRow(s: Split, fastestPace: Int, slowestPace: Int, isBest: Boolean) {
    // Fastest km fills ~45%, slowest fills 100% — differences of a few seconds stay visible
    // while the bar still reads as "longer = slower".
    val span = (slowestPace - fastestPace).coerceAtLeast(1)
    val frac = if (s.paceSecPerKm > 0) {
        (0.45f + 0.55f * ((s.paceSecPerKm - fastestPace).toFloat() / span)).coerceIn(0.1f, 1f)
    } else 0f
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            if (s.distanceKm >= 0.999) "${s.km}" else "%.1f".format(s.distanceKm),
            color = Rb.Text3, fontFamily = FontFamily.Monospace, fontSize = 12.sp,
            modifier = Modifier.width(26.dp),
        )
        Box(
            Modifier.weight(1f).height(14.dp).clip(RoundedCornerShape(4.dp)).background(Rb.Surface3),
        ) {
            Box(
                Modifier.fillMaxWidth(frac).height(14.dp).clip(RoundedCornerShape(4.dp))
                    .background(if (isBest) Rb.Gold else Rb.Blue.copy(alpha = 0.8f)),
            )
        }
        Spacer(Modifier.size(10.dp))
        Text(
            RunMath.paceLabel(s.paceSecPerKm.toDouble()),
            color = if (isBest) Rb.Gold else Rb.Text2,
            fontFamily = FontFamily.Monospace, fontSize = 12.sp,
            modifier = Modifier.width(58.dp),
        )
        if (s.elevationGainM > 0) {
            Text("+${s.elevationGainM}", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 10.sp, modifier = Modifier.width(34.dp))
        }
    }
}
