package app.hitrace.ui.screens

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.data.RunMath
import app.hitrace.data.RunSession
import app.hitrace.data.RunStatus
import app.hitrace.data.RunTracker
import app.hitrace.ui.RouteTrace
import app.hitrace.ui.RunController
import app.hitrace.ui.theme.Rb
import kotlinx.coroutines.delay

@Composable
fun RunningScreen(onBack: () -> Unit, onFinish: () -> Unit, onManual: () -> Unit = {}) {
    val ctx = LocalContext.current
    val run = remember { RunController(ctx) }

    // State lives in the tracking service, so leaving this screen (or the app) doesn't stop the run.
    val points by RunTracker.points.collectAsState()
    val status by RunTracker.status.collectAsState()
    val gpsOk by RunTracker.gpsOk.collectAsState()

    // Location first; then the notification permission the ongoing-run notification needs on 33+.
    val notifyLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    val permLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                notifyLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
            run.start()
        }
    }

    // Ticks the clock while a run is in progress (GPS points can arrive seconds apart).
    var tick by remember { mutableIntStateOf(0) }
    LaunchedEffect(status) {
        while (status == RunStatus.RUNNING) { delay(1000); tick++ }
    }

    val idle = status == RunStatus.IDLE
    val m = remember(points, tick) { RunMath.metrics(points) }
    val preview = if (points.size >= 8) RunMath.score(m) else null

    fun finish() { RunSession.track = run.finish(); onFinish() }

    Column(Modifier.fillMaxSize().background(Rb.Bg).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            LinkText("‹ 홈", onClick = onBack, color = Rb.Muted)
            Spacer(Modifier.weight(1f))
            Text("실시간 주조", color = Rb.Text, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            Text(if (gpsOk) "GPS" else "NO GPS", color = if (gpsOk) Rb.Green else Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Metric(Modifier.weight(1f), "거리", "%.2f".format(m.distanceKm), "km")
            Metric(Modifier.weight(1f), "페이스", RunMath.paceLabel(m.paceSecPerKm), null, accent = true)
            Metric(Modifier.weight(1f), "시간", fmt(m.durationSec), null)
        }

        // Current-kilometre pace: the number that tells you to speed up *now*, unlike the
        // run average which barely moves after the first few minutes.
        if (status != RunStatus.IDLE) {
            val lap = remember(points, tick) { RunMath.lastKmPace(points) }
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("현재 1km 페이스", color = Rb.Muted, fontSize = 12.sp)
                Spacer(Modifier.weight(1f))
                Text(
                    if (lap > 0) RunMath.paceLabel(lap) + " /km" else "1km 이후 표시",
                    color = if (lap > 0) Rb.Gold2 else Rb.Muted,
                    fontFamily = FontFamily.Monospace, fontSize = 13.sp,
                )
            }
        }

        Box(Modifier.fillMaxWidth().height(230.dp).clip(RoundedCornerShape(16.dp)).border(1.dp, Rb.Line, RoundedCornerShape(16.dp))) {
            RouteTrace(points, Modifier.fillMaxSize())
            if (points.size < 2) {
                Text(if (idle) "시작하면 경로가 그려집니다" else "위치 수신 중…", color = Rb.Muted, fontSize = 13.sp, modifier = Modifier.align(Alignment.Center))
            }
        }

        Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Rb.Surface2).border(1.dp, Rb.Line, RoundedCornerShape(14.dp)).padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("주조 예상", color = Rb.Muted, fontSize = 12.sp)
                    Text(if (preview != null) "스코어 ${preview.total}" else "1km 이상 달리면 예측이 시작됩니다", color = Rb.Text2, fontSize = 13.sp)
                }
                if (preview != null) RarityChip(preview.rarity, 0)
            }
        }

        Spacer(Modifier.weight(1f))
        when (status) {
            RunStatus.IDLE -> {
                Button(onClick = { permLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION) }, modifier = Modifier.fillMaxWidth().height(54.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = Rb.Gold, contentColor = Rb.Screen)) { Text("러닝 시작", fontWeight = FontWeight.Bold, fontSize = 16.sp) }
                Spacer(Modifier.height(10.dp))
                OutlinedBtn("데모 러닝 (시뮬레이션)") { run.simulate() }
                LinkText(
                    "GPS 없이 달렸나요? 실내 러닝 →",
                    onClick = onManual,
                    modifier = Modifier.padding(top = 6.dp).fillMaxWidth(),
                    fontSize = 13.sp,
                )
            }
            RunStatus.RUNNING -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedBtn("일시정지", Modifier.weight(1f)) { run.pause() }
                Button(onClick = { finish() }, enabled = m.distanceKm > 0.05, modifier = Modifier.weight(1.6f).height(54.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = Rb.Gold, contentColor = Rb.Screen)) { Text("주조하기", fontWeight = FontWeight.Bold) }
            }
            RunStatus.PAUSED -> Column {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedBtn("재개", Modifier.weight(1f)) { run.resume() }
                    Button(onClick = { finish() }, modifier = Modifier.weight(1.6f).height(54.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = Rb.Gold, contentColor = Rb.Screen)) { Text("주조하기", fontWeight = FontWeight.Bold) }
                }
                // A run now outlives this screen, so it needs an explicit way to throw one away.
                LinkText(
                    "이 러닝 버리기",
                    onClick = { run.cancel(); onBack() },
                    modifier = Modifier.padding(top = 4.dp).fillMaxWidth(),
                    color = Rb.Muted,
                    fontSize = 13.sp,
                )
            }
            RunStatus.FINISHED -> Button(onClick = { finish() }, modifier = Modifier.fillMaxWidth().height(54.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = Rb.Gold, contentColor = Rb.Screen)) { Text("요약 보기", fontWeight = FontWeight.Bold) }
        }
    }
}

@Composable
private fun Metric(modifier: Modifier, label: String, value: String, unit: String?, accent: Boolean = false) {
    Box(modifier.clip(RoundedCornerShape(12.dp)).background(Rb.Surface2).border(1.dp, Rb.Line, RoundedCornerShape(12.dp)).padding(12.dp)) {
        Column {
            Text(label, color = Rb.Muted, fontSize = 11.sp)
            Row(verticalAlignment = Alignment.Bottom) {
                Text(value, color = if (accent) Rb.Gold else Rb.Text, fontFamily = FontFamily.Monospace, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                if (unit != null) Text(unit, color = Rb.Muted, fontSize = 10.sp, modifier = Modifier.padding(start = 2.dp, bottom = 2.dp))
            }
        }
    }
}

@Composable
fun OutlinedBtn(text: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Button(onClick = onClick, modifier = modifier.fillMaxWidth().height(54.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = Rb.Surface3, contentColor = Rb.Text2)) { Text(text, fontWeight = FontWeight.SemiBold) }
}

private fun fmt(sec: Double): String { val m = (sec / 60).toInt(); val s = (sec % 60).toInt(); return "$m:${s.toString().padStart(2, '0')}" }
