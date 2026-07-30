package app.hitrace.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.data.ApiClient
import app.hitrace.data.BladeParts
import app.hitrace.data.ReforgeBody
import app.hitrace.data.Sword
import app.hitrace.ui.theme.Rb
import kotlinx.coroutines.launch
import kotlin.math.max
import kotlin.math.roundToInt

/** 부위 지정 — cut the route timeline into 검신 / 가드 / 자루 segments (cosmetic). */
@Composable
fun PartsScreen(swordId: String, onBack: () -> Unit, onSaved: () -> Unit) {
    val scope = rememberCoroutineScope()
    var sword by remember { mutableStateOf<Sword?>(null) }
    var cut1 by remember { mutableFloatStateOf(58f) }
    var cut2 by remember { mutableFloatStateOf(78f) }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(swordId) {
        val s = runCatching { ApiClient.api.sword(swordId) }.getOrNull()
        sword = s
        s?.shape?.parts?.let { p ->
            cut1 = (p.blade * 100).toFloat().coerceIn(20f, 90f)
            cut2 = ((p.blade + p.guard) * 100).toFloat().coerceIn(cut1 + 5f, 95f)
        }
    }

    val s = sword
    if (s == null) {
        Box(Modifier.fillMaxSize().background(Rb.Bg), contentAlignment = Alignment.Center) {
            Text("타임라인 로딩…", color = Rb.Muted, fontSize = 13.sp)
        }
        return
    }

    val totalKm = max(1, (s.shape.lengthScale / 0.08).roundToInt())
    fun seg(a: Float, b: Float) = "%.1f".format((b - a) / 100f * totalKm)

    Column(
        Modifier.fillMaxSize().background(Rb.Bg).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            LinkText("‹ 공방", onClick = onBack, color = Rb.Muted)
            Spacer(Modifier.weight(1f))
            Text("부위 지정", color = Rb.Text, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            LinkText("자동 배치", onClick = { cut1 = 58f; cut2 = 78f }, fontSize = 13.sp)
        }

        RbCard {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("경로 타임라인", color = Rb.Text3, fontSize = 12.5.sp)
                    Spacer(Modifier.size(6.dp))
                    Text("${totalKm}km", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
                    Spacer(Modifier.weight(1f))
                    Text("핸들로 자르기", color = Rb.Muted, fontSize = 11.5.sp)
                }
                Row(
                    Modifier.fillMaxWidth().height(34.dp).clip(RoundedCornerShape(8.dp))
                        .border(1.dp, Rb.Line, RoundedCornerShape(8.dp)),
                ) {
                    Seg(Modifier.weight(cut1), Rb.Gold, "검신 ${seg(0f, cut1)}km")
                    Seg(Modifier.weight(cut2 - cut1), Rb.Blue, "가드")
                    Seg(Modifier.weight(100f - cut2), Rb.Purple, "자루")
                }
                Text("검신 / 가드 경계", color = Rb.Muted, fontSize = 11.sp)
                Slider(
                    value = cut1,
                    onValueChange = { cut1 = it.coerceIn(20f, cut2 - 5f) },
                    valueRange = 20f..90f,
                    colors = SliderDefaults.colors(thumbColor = Rb.Gold, activeTrackColor = Rb.Gold, inactiveTrackColor = Rb.Surface4),
                )
                Text("가드 / 자루 경계", color = Rb.Muted, fontSize = 11.sp)
                Slider(
                    value = cut2,
                    onValueChange = { cut2 = it.coerceIn(cut1 + 5f, 95f) },
                    valueRange = 25f..95f,
                    colors = SliderDefaults.colors(thumbColor = Rb.Blue, activeTrackColor = Rb.Blue, inactiveTrackColor = Rb.Surface4),
                )
            }
        }

        PartRow(Rb.Gold, "검신 — 앞 구간", seg(0f, cut1))
        PartRow(Rb.Blue, "가드 — 중간 교차", seg(cut1, cut2))
        PartRow(Rb.Purple, "자루 — 마지막 구간", seg(cut2, 100f))

        Text(
            "경로의 구간을 검신·가드·자루에 배치합니다. 외형 전용 — 스탯은 변하지 않습니다.",
            color = Rb.Muted, fontSize = 11.5.sp, lineHeight = 17.sp,
        )

        Spacer(Modifier.weight(1f))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            RbGhostButton("되돌리기", Modifier.weight(1f), onClick = onBack)
            RbButton(if (busy) "적용 중…" else "배치 적용", Modifier.weight(1.6f), enabled = !busy) {
                busy = true
                scope.launch {
                    val parts = BladeParts(
                        blade = (cut1 / 100f).toDouble(),
                        guard = ((cut2 - cut1) / 100f).toDouble(),
                        handle = ((100f - cut2) / 100f).toDouble(),
                    )
                    runCatching { ApiClient.api.reforge(s.id, ReforgeBody(s.shape.copy(parts = parts))) }
                        .onSuccess { onSaved() }
                    busy = false
                }
            }
        }
    }
}

@Composable
private fun Seg(modifier: Modifier, tone: Color, label: String) {
    Box(modifier.fillMaxHeight().background(tone.copy(alpha = 0.28f)), contentAlignment = Alignment.Center) {
        Text(label, color = tone, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

@Composable
private fun PartRow(tone: Color, label: String, km: String) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Rb.Surface2)
            .border(1.dp, tone.copy(alpha = 0.35f), RoundedCornerShape(12.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(10.dp).clip(RoundedCornerShape(3.dp)).background(tone))
        Spacer(Modifier.size(10.dp))
        Text(label, color = Rb.Text, fontSize = 13.sp, fontWeight = FontWeight.Medium)
        Spacer(Modifier.weight(1f))
        Text("${km}km", color = Rb.Text3, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
    }
}
