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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.AppViewModel
import app.hitrace.data.ApiClient
import app.hitrace.data.CrashReporter
import app.hitrace.data.RunMath
import app.hitrace.ui.rememberLoad
import app.hitrace.ui.theme.Rb

@Composable
fun ProfileScreen(
    vm: AppViewModel,
    onCodex: () -> Unit = {},
    onSeason: () -> Unit = {},
    onHistory: () -> Unit = {},
    onStats: () -> Unit = {},
) {
    val profile = rememberLoad { ApiClient.api.profile() }
    // A runner profile leads with running: volume, pace, records. Swords come after.
    val stats = rememberLoad { ApiClient.api.runningStats() }
    Column(Modifier.fillMaxSize().background(Rb.Bg).verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("RUNNER", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp, letterSpacing = 2.sp)
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(profile?.user?.handle ?: "…", color = Rb.Text, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            profile?.user?.streakDays?.takeIf { it > 0 }?.let {
                Text("🔥 ${it}일 연속", color = Rb.Gold2, fontSize = 12.sp)
            }
        }

        val t = profile?.totals
        val all = stats?.allTime

        // Lifetime running totals — the headline of a running profile.
        Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Rb.Surface2)
            .border(1.dp, Rb.Line, RoundedCornerShape(14.dp)).padding(16.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        "%.1f".format(all?.distanceKm ?: t?.totalKm ?: 0.0),
                        color = Rb.Gold, fontFamily = FontFamily.Monospace, fontSize = 30.sp, fontWeight = FontWeight.Bold,
                    )
                    Text("km 누적", color = Rb.Muted, fontSize = 12.sp, modifier = Modifier.padding(start = 4.dp, bottom = 4.dp))
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(22.dp)) {
                    Mini("러닝", "${all?.runs ?: t?.runCount ?: 0}회")
                    Mini("시간", hms(all?.durationSec ?: 0))
                    Mini(
                        "평균 페이스",
                        all?.avgPaceSecPerKm?.takeIf { it > 0 }?.let { RunMath.paceLabel(it.toDouble()) } ?: "—",
                    )
                }
            }
        }

        // Personal bests, three at a glance; the rest live in 러닝 통계.
        stats?.personalBests?.let { pb ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Big(Modifier.weight(1f), "최장 거리", "%.1f".format(pb.longestKm), "km", accent = true)
                Big(
                    Modifier.weight(1f), "최고 페이스",
                    if (pb.fastestPaceSecPerKm > 0) RunMath.paceLabel(pb.fastestPaceSecPerKm.toDouble()) else "—",
                    "/km",
                )
                Big(Modifier.weight(1f), "최대 고도", "${pb.biggestClimbM}", "m")
            }
        }

        Text("COLLECTION", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp, letterSpacing = 2.sp, modifier = Modifier.padding(top = 6.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Big(Modifier.weight(1f), "주조한 검", "${t?.swords ?: 0}", null)
            Big(Modifier.weight(1f), "최고 CP", "${t?.bestCp ?: 0}", null, accent = true)
        }
        Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Rb.Surface2).border(1.dp, Rb.Line, RoundedCornerShape(14.dp)).padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround) {
                listOf("LEGEND", "SR", "R", "N").forEach { r ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("${t?.byRarity?.get(r) ?: 0}", color = Rb.rarityColor(r), fontFamily = FontFamily.Monospace, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        Text(r, color = Rb.Muted, fontSize = 11.sp)
                    }
                }
            }
        }

        Text("RUNNING", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp, letterSpacing = 2.sp, modifier = Modifier.padding(top = 6.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            RbGhostButton("러닝 기록", Modifier.weight(1f), tone = Rb.Gold, onClick = onHistory)
            RbGhostButton("러닝 통계", Modifier.weight(1f), onClick = onStats)
        }

        Row(Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            RbGhostButton("명검 도감", Modifier.weight(1f), onClick = onCodex)
            RbGhostButton("시즌 패스", Modifier.weight(1f), onClick = onSeason)
        }

        // Only appears if the app actually died last time. Writing the trace to disk is useless
        // unless someone can see that it happened and tell us.
        val ctx = LocalContext.current
        var crash by remember { mutableStateOf(CrashReporter.lastCrash(ctx)) }
        crash?.let { text ->
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Rb.Surface2)
                    .border(1.dp, Rb.Line, RoundedCornerShape(14.dp)).padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text("지난 실행에서 앱이 종료되었습니다", color = Rb.Text2, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                Text(
                    text.lineSequence().drop(5).firstOrNull { it.isNotBlank() }?.take(120) ?: "",
                    color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 10.sp,
                )
                LinkText(
                    "지우기",
                    onClick = { CrashReporter.clear(ctx); crash = null },
                    color = Rb.Muted, fontSize = 12.sp,
                )
            }
        }

        Button(
            onClick = { vm.logout() },
            modifier = Modifier.fillMaxWidth().height(50.dp).padding(top = 8.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Rb.Surface3, contentColor = Rb.Text2),
        ) { Text("로그아웃") }
    }
}

@Composable
private fun Big(modifier: Modifier, label: String, value: String, unit: String?, accent: Boolean = false) {
    Box(modifier.clip(RoundedCornerShape(14.dp)).background(Rb.Surface2).border(1.dp, Rb.Line, RoundedCornerShape(14.dp)).padding(14.dp)) {
        Column {
            Text(label, color = Rb.Muted, fontSize = 11.sp)
            Row(verticalAlignment = Alignment.Bottom) {
                Text(value, color = if (accent) Rb.Gold else Rb.Text, fontFamily = FontFamily.Monospace, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                if (unit != null) Text(unit, color = Rb.Muted, fontSize = 11.sp, modifier = Modifier.padding(start = 2.dp, bottom = 3.dp))
            }
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
