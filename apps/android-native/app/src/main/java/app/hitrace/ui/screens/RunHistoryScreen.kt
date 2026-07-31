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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.data.ApiClient
import app.hitrace.data.RunMath
import app.hitrace.data.RunSummary
import app.hitrace.ui.rememberLoad
import app.hitrace.ui.theme.Rb
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** 러닝 기록 — every run, newest first. The list a running app is judged by. */
@Composable
fun RunHistoryScreen(onBack: () -> Unit, onOpen: (String) -> Unit, onStartRun: () -> Unit) {
    val runs = rememberLoad { ApiClient.api.runs(100) }

    Column(
        Modifier.fillMaxSize().background(Rb.Bg).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        ScreenHeader("프로필", onBack) {
            runs?.let {
                Text("${it.size}회", color = Rb.Gold2, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
            }
        }
        Text("러닝 기록", color = Rb.Text, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)

        when {
            runs == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("불러오는 중…", color = Rb.Muted, fontSize = 13.sp)
            }
            runs.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("아직 기록된 러닝이 없습니다", color = Rb.Text3, fontSize = 14.sp)
                    LinkText("첫 러닝 시작하기 →", onClick = onStartRun, modifier = Modifier.padding(top = 4.dp), fontSize = 13.sp)
                }
            }
            else -> LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                // Grouped by month with that month's volume — a log without totals is just a list.
                runs.groupBy { monthLabel(it.startedAt) }.forEach { (month, monthRuns) ->
                    item(key = "h-$month") {
                        Row(
                            Modifier.fillMaxWidth().padding(top = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(month, color = Rb.Text3, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                            Spacer(Modifier.weight(1f))
                            Text(
                                "%.1fkm · %d회".format(monthRuns.sumOf { it.distanceKm }, monthRuns.size),
                                color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp,
                            )
                        }
                    }
                    items(monthRuns, key = { it.id }) { r -> RunRow(r, onClick = { onOpen(r.id) }) }
                }
            }
        }
    }
}

@Composable
private fun RunRow(r: RunSummary, onClick: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Rb.Surface2)
            .border(1.dp, Rb.Line, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick).padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(dayLabel(r.startedAt), color = Rb.Text, fontSize = 14.sp, fontWeight = FontWeight.Medium)
            Spacer(Modifier.size(8.dp))
            Text(timeLabel(r.startedAt), color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
            Spacer(Modifier.weight(1f))
            if (r.isIndoor) Tag("실내", Rb.Blue)
            if (r.swordId != null) {
                Spacer(Modifier.size(6.dp))
                Tag("주조", Rb.Gold)
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(18.dp)) {
            Metric("%.2f".format(r.distanceKm), "km", Rb.Gold, big = true)
            Metric(RunMath.paceLabel(r.avgPaceSecPerKm.toDouble()), "/km", Rb.Text)
            Metric(hms(r.durationSec), "", Rb.Text)
            if (r.elevationGainM > 0) Metric("${r.elevationGainM}", "m↑", Rb.Text3)
        }
    }
}

@Composable
private fun Metric(value: String, unit: String, color: androidx.compose.ui.graphics.Color, big: Boolean = false) {
    Row(verticalAlignment = Alignment.Bottom) {
        Text(value, color = color, fontFamily = FontFamily.Monospace, fontSize = if (big) 20.sp else 15.sp, fontWeight = FontWeight.SemiBold)
        if (unit.isNotEmpty()) {
            Text(unit, color = Rb.Muted, fontSize = 10.sp, modifier = Modifier.padding(start = 2.dp, bottom = 2.dp))
        }
    }
}

@Composable
private fun Tag(text: String, tone: androidx.compose.ui.graphics.Color) {
    Text(
        text, color = tone, fontFamily = FontFamily.Monospace, fontSize = 10.sp,
        modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(tone.copy(alpha = 0.13f))
            .padding(horizontal = 6.dp, vertical = 2.dp),
    )
}

// ── date helpers (shared with the detail screen) ────────────────────────────

private val dayFmt = SimpleDateFormat("M월 d일 (E)", Locale.KOREAN)
private val timeFmt = SimpleDateFormat("a h:mm", Locale.KOREAN)

fun dayLabel(ts: Long): String = dayFmt.format(Date(ts))
fun timeLabel(ts: Long): String = timeFmt.format(Date(ts))

private val shortFmt = SimpleDateFormat("M/d (E)", Locale.KOREAN)
private val monthFmt = SimpleDateFormat("yyyy년 M월", Locale.KOREAN)

fun shortDay(ts: Long): String = shortFmt.format(Date(ts))
fun monthLabel(ts: Long): String = monthFmt.format(Date(ts))

/** 1:23:45 for long runs, 23:45 for short ones. */
fun hms(sec: Int): String {
    val h = sec / 3600
    val m = (sec % 3600) / 60
    val s = sec % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}
