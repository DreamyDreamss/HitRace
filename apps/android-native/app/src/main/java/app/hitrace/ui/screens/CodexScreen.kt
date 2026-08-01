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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.data.ApiClient
import app.hitrace.data.CodexEntry
import app.hitrace.ui.BladeCanvas
import app.hitrace.ui.rememberLoad
import app.hitrace.ui.theme.Rb

/** 명검 도감 — every course ever forged, kept forever (survives dismantling the sword). */
@Composable
fun CodexScreen(onBack: () -> Unit, onCourse: (String) -> Unit = {}) {
    val data = rememberLoad { ApiClient.api.codex() }
    if (data == null) {
        Box(Modifier.fillMaxSize().background(Rb.Bg), contentAlignment = Alignment.Center) {
            Text("도감 여는 중…", color = Rb.Muted, fontSize = 13.sp)
        }
        return
    }

    Column(
        Modifier.fillMaxSize().background(Rb.Bg).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        ScreenHeader("프로필", onBack) {
            Text("${data.totals.courses}코스", color = Rb.Gold2, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
        }
        Text("명검 도감", color = Rb.Text, fontSize = 22.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
        Text(
            "달려서 검으로 주조한 모든 코스가 이곳에 영원히 남습니다.\n검을 분해해도 그날의 길은 사라지지 않습니다.",
            color = Rb.Text3, fontSize = 12.sp, lineHeight = 18.sp,
        )

        if (data.entries.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("아직 기록된 코스가 없습니다.", color = Rb.Text3, fontSize = 14.sp, textAlign = TextAlign.Center)
            }
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                items(data.entries) { e -> CodexCard(e, onClick = { onCourse(e.courseHash) }) }
            }
        }
    }
}

@Composable
private fun CodexCard(e: CodexEntry, onClick: () -> Unit) {
    val c = Rb.rarityColor(e.bestRarity)
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Rb.Surface2)
            .border(1.dp, Rb.Line, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick).padding(10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        BladeCanvas(e.shape, e.bestRarity, modifier = Modifier.size(40.dp, 96.dp))
        Text(e.name, color = Rb.Text, fontSize = 11.sp, maxLines = 1, textAlign = TextAlign.Center)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                e.bestRarity,
                color = c,
                fontFamily = FontFamily.Monospace,
                fontSize = 9.sp,
                modifier = Modifier.clip(RoundedCornerShape(4.dp)).background(c.copy(alpha = 0.13f)).padding(horizontal = 5.dp, vertical = 2.dp),
            )
            if (e.timesForged > 1) {
                Spacer(Modifier.size(4.dp))
                Text("×${e.timesForged}", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 9.sp)
            }
        }
    }
}
