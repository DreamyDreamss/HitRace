package app.hitrace.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.AppViewModel
import app.hitrace.data.ApiClient
import app.hitrace.data.Sword
import app.hitrace.ui.BladeCanvas
import app.hitrace.ui.rememberLoad
import app.hitrace.ui.theme.Rb

@Composable
fun CollectionScreen(
    vm: AppViewModel,
    onOpen: (String) -> Unit = {},
    onFusion: () -> Unit = {},
    onStartRun: () -> Unit = {},
) {
    val swords = rememberLoad { ApiClient.api.swords() } ?: emptyList()
    Column(Modifier.fillMaxSize().background(Rb.Bg).padding(horizontal = 20.dp)) {
        Text("보관함 ${swords.size}/60", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp,
            modifier = Modifier.padding(top = 20.dp))
        androidx.compose.foundation.layout.Row(
            Modifier.fillMaxWidth().padding(bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("컬렉션", color = Rb.Text, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
            androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
            LinkText("합주조 ›", onClick = onFusion, color = Rb.Gold, fontSize = 13.sp)
        }
        if (swords.isEmpty()) {
            androidx.compose.foundation.layout.Box(
                Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                androidx.compose.foundation.layout.Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("아직 주조한 검이 없습니다", color = Rb.Text3, fontSize = 14.sp)
                    LinkText(
                        "달린 경로가 첫 검이 됩니다 →",
                        onClick = onStartRun,
                        modifier = Modifier.padding(top = 4.dp),
                        fontSize = 13.sp,
                    )
                }
            }
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                items(swords) { s -> SwordCard(s, onClick = { onOpen(s.id) }) }
            }
        }
    }
}

@Composable
private fun SwordCard(s: Sword, onClick: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Rb.Surface2)
            .border(1.dp, Rb.Line, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick).padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        BladeCanvas(s.shape, s.rarity, glow = s.rarity == "LEGEND", modifier = Modifier.size(54.dp, 130.dp))
        Text(s.name, color = Rb.Text, fontSize = 13.sp, fontWeight = FontWeight.Medium, maxLines = 1)
        androidx.compose.foundation.layout.Row(verticalAlignment = Alignment.CenterVertically) {
            RarityChip(s.rarity, s.plus)
            androidx.compose.foundation.layout.Spacer(Modifier.size(6.dp))
            Text("CP ${s.cp}", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
        }
    }
}
