package app.hitrace.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
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
import app.hitrace.data.ManualRunBody
import app.hitrace.data.RunMath
import app.hitrace.data.RunSession
import app.hitrace.ui.theme.Rb
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/**
 * 실내 러닝 — no-GPS / treadmill entry. Distance + pace only; the server forges a
 * procedural blade with a capped score (LEGEND, 眞 양날 and codex stay GPS-only).
 */
@Composable
fun ManualRunScreen(vm: AppViewModel, onBack: () -> Unit, onForged: () -> Unit) {
    val scope = rememberCoroutineScope()
    var km by remember { mutableFloatStateOf(5f) }
    var paceSec by remember { mutableFloatStateOf(330f) }
    var busy by remember { mutableStateOf(false) }
    var err by remember { mutableStateOf<String?>(null) }

    Column(
        Modifier.fillMaxSize().background(Rb.Bg).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            LinkText("‹ 러닝", onClick = onBack, color = Rb.Muted)
            Spacer(Modifier.weight(1f))
            Text("실내 러닝", color = Rb.Text, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
        }

        Text(
            "트레드밀·실내에서 GPS 없이 달렸다면 거리와 페이스를 입력하세요. 절제된 형태의 단련검이 주조됩니다. " +
                "(실외 GPS 러닝만 LEGEND·眞 양날·도감 등재가 가능합니다.)",
            color = Rb.Text3, fontSize = 12.5.sp, lineHeight = 19.sp,
        )

        RbCard {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("거리", color = Rb.Text3, fontSize = 13.sp)
                    Spacer(Modifier.weight(1f))
                    Text("%.1f".format(km), color = Rb.Gold, fontFamily = FontFamily.Monospace, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                    Text("km", color = Rb.Muted, fontSize = 11.sp, modifier = Modifier.padding(start = 3.dp))
                }
                Slider(
                    value = km,
                    onValueChange = { km = (it * 2).roundToInt() / 2f },
                    valueRange = 1f..30f,
                    colors = SliderDefaults.colors(thumbColor = Rb.Gold, activeTrackColor = Rb.Gold, inactiveTrackColor = Rb.Surface4),
                )
            }
        }

        RbCard {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("페이스", color = Rb.Text3, fontSize = 13.sp)
                    Text(" /km", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
                    Spacer(Modifier.weight(1f))
                    Text(RunMath.paceLabel(paceSec.toDouble()), color = Rb.Blue, fontFamily = FontFamily.Monospace, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                }
                Slider(
                    value = paceSec,
                    onValueChange = { paceSec = (it / 5f).roundToInt() * 5f },
                    valueRange = 180f..480f,
                    colors = SliderDefaults.colors(thumbColor = Rb.Blue, activeTrackColor = Rb.Blue, inactiveTrackColor = Rb.Surface4),
                )
            }
        }

        RbCard {
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("예상 시간", color = Rb.Text3, fontSize = 12.5.sp)
                Spacer(Modifier.weight(1f))
                Text("${(km * paceSec / 60).toInt()}분", color = Rb.Text2, fontFamily = FontFamily.Monospace, fontSize = 12.5.sp)
            }
        }

        err?.let { Text(it, color = Rb.Red, fontSize = 12.5.sp) }

        Spacer(Modifier.weight(1f))
        RbButton(if (busy) "주조 중…" else "단련검 주조", Modifier.fillMaxWidth(), enabled = !busy) {
            busy = true; err = null
            scope.launch {
                runCatching { ApiClient.api.manualRun(ManualRunBody(km.toDouble(), paceSec.roundToInt())) }
                    .onSuccess { res ->
                        // All three, not just the sword: the reveal screen reads records and the
                        // weekly goal too, and leaving them stale showed the *previous* run's
                        // 🏆 badges on a treadmill blade.
                        RunSession.forged = res.sword
                        RunSession.records = res.records
                        RunSession.weeklyGoal = res.weeklyGoal
                        vm.refresh()
                        onForged()
                    }
                    .onFailure { err = "오늘 주조 한도(2자루)를 모두 사용했거나 입력이 유효하지 않습니다." }
                busy = false
            }
        }
    }
}
