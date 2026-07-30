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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.data.ApiClient
import app.hitrace.data.BladeTransform
import app.hitrace.data.CraftSession
import app.hitrace.data.ReforgeBody
import app.hitrace.data.Sword
import app.hitrace.ui.BladeCanvas
import app.hitrace.ui.theme.Rb
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/** 주조 공방 — cosmetic-only reforge: rotate / flip / mirror / scale. Stats never change. */
@Composable
fun WorkshopScreen(swordId: String, onBack: () -> Unit, onParts: (String) -> Unit, onSaved: () -> Unit) {
    val scope = rememberCoroutineScope()
    var sword by remember { mutableStateOf<Sword?>(null) }
    var t by remember { mutableStateOf(BladeTransform()) }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(swordId) {
        val s = runCatching { ApiClient.api.sword(swordId) }.getOrNull()
        sword = s
        // A transform in progress (we came back from 부위 지정) wins over the saved one.
        t = CraftSession.take(swordId) ?: s?.shape?.transform ?: BladeTransform()
    }

    val s = sword
    if (s == null) {
        Box(Modifier.fillMaxSize().background(Rb.Bg), contentAlignment = Alignment.Center) {
            Text("공방 준비 중…", color = Rb.Muted, fontSize = 13.sp)
        }
        return
    }

    Column(
        Modifier.fillMaxSize().background(Rb.Bg).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            LinkText("‹ 취소", onClick = onBack, color = Rb.Muted)
            Spacer(Modifier.weight(1f))
            Text("주조 공방", color = Rb.Text, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            LinkText("초기화", onClick = { t = BladeTransform() }, fontSize = 13.sp)
        }

        // Preview stage
        Box(
            Modifier.fillMaxWidth().weight(1f).heightIn(min = 240.dp).clip(RoundedCornerShape(18.dp))
                .background(Rb.Deep).border(1.dp, Rb.Line, RoundedCornerShape(18.dp)),
            contentAlignment = Alignment.Center,
        ) {
            BladeCanvas(s.shape.copy(transform = t), s.rarity, glow = true, modifier = Modifier.size(150.dp, 300.dp))
            Column(
                Modifier.align(Alignment.TopStart).padding(12.dp).clip(RoundedCornerShape(8.dp))
                    .background(Rb.Screen.copy(alpha = 0.8f)).border(1.dp, Rb.Line, RoundedCornerShape(8.dp))
                    .padding(horizontal = 10.dp, vertical = 6.dp),
            ) {
                Text("회전", color = Rb.Muted, fontSize = 10.sp)
                Text("${t.rotate}°", color = Rb.Gold, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
            }
            if (t.mirror) {
                Text(
                    "미러 대칭 ON — 양날 미리보기",
                    color = Rb.Purple, fontSize = 12.sp,
                    modifier = Modifier.align(Alignment.BottomCenter).padding(12.dp)
                        .clip(RoundedCornerShape(999.dp)).background(Rb.Purple.copy(alpha = 0.12f))
                        .border(1.dp, Rb.Purple.copy(alpha = 0.35f), RoundedCornerShape(999.dp))
                        .padding(horizontal = 14.dp, vertical = 6.dp),
                )
            }
        }

        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("회전", color = Rb.Text3, fontSize = 12.5.sp)
            Spacer(Modifier.size(6.dp))
            Text("15° 스냅", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
            Spacer(Modifier.weight(1f))
            Text("${t.rotate}°", color = Rb.Text2, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
        }
        Slider(
            value = t.rotate.toFloat(),
            onValueChange = { v -> t = t.copy(rotate = ((v / 15f).roundToInt() * 15)) },
            valueRange = -180f..180f,
            steps = 23,
            colors = SliderDefaults.colors(thumbColor = Rb.Gold, activeTrackColor = Rb.Gold, inactiveTrackColor = Rb.Surface4),
        )

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Toggle("좌우 반전", t.flipH, Modifier.weight(1f)) { t = t.copy(flipH = !t.flipH) }
            Toggle("상하 반전", t.flipV, Modifier.weight(1f)) { t = t.copy(flipV = !t.flipV) }
            Toggle("미러 대칭", t.mirror, Modifier.weight(1f), tone = Rb.Purple) { t = t.copy(mirror = !t.mirror) }
            Toggle("스케일 ${(t.scale * 100).roundToInt()}%", t.scale != 1.0, Modifier.weight(1f)) {
                t = t.copy(scale = if (t.scale >= 1.2) 0.8 else ((t.scale + 0.1) * 10).roundToInt() / 10.0)
            }
        }

        Text(
            "변형은 외형에만 작용합니다 — 스탯은 변하지 않습니다. 실제 왕복 코스로 만든 양날검만 도감에 \"眞 양날\"로 표기됩니다.",
            color = Rb.Muted, fontSize = 11.5.sp, lineHeight = 17.sp,
        )

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            RbGhostButton("부위 지정", Modifier.weight(1f)) { CraftSession.remember(s.id, t); onParts(s.id) }
            RbButton(if (busy) "주조 중…" else "이대로 주조", Modifier.weight(1.6f), enabled = !busy) {
                busy = true
                scope.launch {
                    runCatching { ApiClient.api.reforge(s.id, ReforgeBody(s.shape.copy(transform = t))) }
                        .onSuccess { CraftSession.clear(); onSaved() }
                    busy = false
                }
            }
        }
    }
}

@Composable
private fun Toggle(label: String, active: Boolean, modifier: Modifier, tone: Color = Rb.Gold, onClick: () -> Unit) {
    Box(
        modifier.clip(RoundedCornerShape(12.dp))
            .background(if (active) tone.copy(alpha = 0.10f) else Rb.Surface2)
            .border(1.dp, if (active) tone.copy(alpha = 0.4f) else Rb.Line, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp, horizontal = 4.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = if (active) tone else Rb.Text3, fontSize = 11.sp, textAlign = TextAlign.Center, maxLines = 2)
    }
}
