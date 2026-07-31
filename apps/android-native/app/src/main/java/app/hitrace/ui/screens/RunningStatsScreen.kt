package app.hitrace.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import app.hitrace.data.PersonalBests
import app.hitrace.data.RunMath
import app.hitrace.data.VolumeStat
import app.hitrace.data.WeeklyBucket
import app.hitrace.ui.rememberLoad
import app.hitrace.ui.theme.Rb
import kotlin.math.abs
import kotlin.math.roundToInt

/** 러닝 통계 — this week against last, a 12-week trend, and the records worth chasing. */
@Composable
fun RunningStatsScreen(onBack: () -> Unit) {
    val stats = rememberLoad { ApiClient.api.runningStats() }
    if (stats == null) {
        Box(Modifier.fillMaxSize().background(Rb.Bg), contentAlignment = Alignment.Center) {
            Text("통계 계산 중…", color = Rb.Muted, fontSize = 13.sp)
        }
        return
    }

    Column(
        Modifier.fillMaxSize().background(Rb.Bg).verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        ScreenHeader("프로필", onBack)
        Text("러닝 통계", color = Rb.Text, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)

        WeekCompareCard(stats.thisWeek, stats.lastWeek)

        Eyebrow("최근 12주")
        RbCard {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                WeeklyChart(stats.weekly)
                Text(
                    "막대 하나가 한 주입니다. 오른쪽 끝이 이번 주.",
                    color = Rb.Muted, fontSize = 11.sp,
                )
            }
        }

        Eyebrow("누적")
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            TotalCard(Modifier.weight(1f), "이번 달", stats.thisMonth)
            TotalCard(Modifier.weight(1f), "전체", stats.allTime)
        }

        Eyebrow("개인 기록")
        PersonalBestCards(stats.personalBests)
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun WeekCompareCard(thisWeek: VolumeStat, lastWeek: VolumeStat) {
    val delta = thisWeek.distanceKm - lastWeek.distanceKm
    RbCard {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
                Column {
                    Text("이번 주", color = Rb.Text3, fontSize = 12.sp)
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(
                            "%.1f".format(thisWeek.distanceKm), color = Rb.Gold,
                            fontFamily = FontFamily.Monospace, fontSize = 30.sp, fontWeight = FontWeight.Bold,
                        )
                        Text("km", color = Rb.Muted, fontSize = 12.sp, modifier = Modifier.padding(start = 3.dp, bottom = 4.dp))
                    }
                }
                Spacer(Modifier.weight(1f))
                // Against last week — the comparison runners actually care about.
                Text(
                    when {
                        lastWeek.runs == 0 && thisWeek.runs == 0 -> "기록 없음"
                        lastWeek.runs == 0 -> "지난주 기록 없음"
                        abs(delta) < 0.05 -> "지난주와 같음"
                        delta > 0 -> "지난주 대비 +%.1fkm".format(delta)
                        else -> "지난주 대비 %.1fkm".format(delta)
                    },
                    // Green means "you beat last week" — not "there was no last week".
                    color = when {
                        lastWeek.runs == 0 -> Rb.Text3
                        delta > 0.05 -> Rb.Green
                        delta < -0.05 -> Rb.Muted
                        else -> Rb.Text3
                    },
                    fontSize = 12.sp,
                )
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                Mini("횟수", "${thisWeek.runs}회")
                Mini("시간", hms(thisWeek.durationSec))
                Mini("평균 페이스", if (thisWeek.avgPaceSecPerKm > 0) RunMath.paceLabel(thisWeek.avgPaceSecPerKm.toDouble()) else "—")
            }
        }
    }
}

@Composable
private fun WeeklyChart(weeks: List<WeeklyBucket>) {
    val max = (weeks.maxOfOrNull { it.distanceKm } ?: 0.0).coerceAtLeast(1.0)
    Row(
        Modifier.fillMaxWidth().height(110.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        weeks.forEachIndexed { i, w ->
            val isCurrent = i == weeks.lastIndex
            Column(
                Modifier.weight(1f).fillMaxHeight(),
                verticalArrangement = Arrangement.Bottom,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                if (w.distanceKm > 0) {
                    Text(
                        "%.0f".format(w.distanceKm), color = if (isCurrent) Rb.Gold else Rb.Muted,
                        fontFamily = FontFamily.Monospace, fontSize = 9.sp,
                    )
                }
                Box(
                    Modifier
                        .fillMaxWidth()
                        // Empty weeks still show a sliver so the timeline stays readable.
                        .height((10 + 88 * (w.distanceKm / max)).dp.coerceAtLeast(3.dp))
                        .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                        .background(if (isCurrent) Rb.Gold else Rb.Surface4),
                )
            }
        }
    }
}

@Composable
private fun TotalCard(modifier: Modifier, label: String, v: VolumeStat) {
    RbCard(modifier) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(label, color = Rb.Muted, fontSize = 11.sp)
            Row(verticalAlignment = Alignment.Bottom) {
                Text("%.1f".format(v.distanceKm), color = Rb.Text, fontFamily = FontFamily.Monospace, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                Text("km", color = Rb.Muted, fontSize = 10.sp, modifier = Modifier.padding(start = 2.dp, bottom = 2.dp))
            }
            Text("${v.runs}회 · ${hms(v.durationSec)}", color = Rb.Text3, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
        }
    }
}

@Composable
private fun PersonalBestCards(pb: PersonalBests) {
    val items = listOf(
        Triple("최장 거리", "%.1f km".format(pb.longestKm), Rb.Gold),
        Triple("최장 시간", hms(pb.longestDurationSec), Rb.Text),
        Triple("최고 페이스", if (pb.fastestPaceSecPerKm > 0) RunMath.paceLabel(pb.fastestPaceSecPerKm.toDouble()) + " /km" else "—", Rb.Blue),
        Triple("최대 고도", "${pb.biggestClimbM} m", Rb.Purple),
        Triple("연속 러닝", "${pb.longestStreakDays}일", Rb.Green),
    )
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items.chunked(2).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { (label, value, tone) -> PbCard(Modifier.weight(1f), label, value, tone) }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun PbCard(modifier: Modifier, label: String, value: String, tone: Color) {
    RbCard(modifier) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(label, color = Rb.Muted, fontSize = 11.sp)
            Text(value, color = tone, fontFamily = FontFamily.Monospace, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun Mini(label: String, value: String) {
    Column {
        Text(label, color = Rb.Muted, fontSize = 10.sp)
        Text(value, color = Rb.Text2, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
    }
}

@Suppress("unused")
private fun pct(a: Double, b: Double) = if (b == 0.0) 0 else ((a - b) / b * 100).roundToInt()
