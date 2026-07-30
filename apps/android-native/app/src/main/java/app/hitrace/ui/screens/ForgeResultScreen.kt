package app.hitrace.ui.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.data.RunSession
import app.hitrace.data.Sword
import app.hitrace.ui.BladeCanvas
import app.hitrace.ui.theme.Rb

@Composable
fun ForgeResultScreen(onDone: () -> Unit) {
    val sword = RunSession.forged
    if (sword == null) { onDone(); return }
    val c = Rb.rarityColor(sword.rarity)
    val reveal = remember { Animatable(0f) }
    LaunchedEffect(Unit) { reveal.animateTo(1f, tween(750)) }

    Column(Modifier.fillMaxSize().background(Rb.Bg).padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Spacer(Modifier.height(8.dp))
        Text("FORGED · ${sword.rarity}", color = c, fontFamily = FontFamily.Monospace, fontSize = 12.sp, letterSpacing = 3.sp)
        Text("달린 경로가 검이 되었습니다", color = Rb.Text3, fontSize = 13.sp)
        Spacer(Modifier.weight(1f))
        BladeCanvas(sword.shape, sword.rarity, glow = true, modifier = Modifier.size(150.dp, 320.dp).scale(0.6f + 0.4f * reveal.value).alpha(reveal.value))
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (sword.shape.trueDoubleEdge) { Text("眞 양날", color = Rb.Gold2, fontFamily = FontFamily.Monospace, fontSize = 11.sp); Spacer(Modifier.size(8.dp)) }
            Text("CP ${sword.cp}", color = c, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
        }
        Spacer(Modifier.weight(1f))
        StatBars(sword)
        Button(onClick = { RunSession.track = null; RunSession.forged = null; onDone() }, modifier = Modifier.fillMaxWidth().height(54.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = Rb.Gold, contentColor = Rb.Screen)) {
            Text("완료", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }
    }
}

@Composable
private fun StatBars(s: Sword) {
    val meta = listOf("예리함" to s.stats.sharpness, "중량" to s.stats.weight, "내구" to s.stats.durability, "마력" to s.stats.magic)
    val colors = listOf(Rb.Gold, Rb.Blue, Rb.Text2, Rb.Purple)
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Rb.Surface2).border(1.dp, Rb.Line, RoundedCornerShape(14.dp)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        meta.forEachIndexed { i, (k, v) ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(k, color = Rb.Text3, fontSize = 12.sp, modifier = Modifier.width(46.dp))
                Box(Modifier.weight(1f).height(6.dp).clip(RoundedCornerShape(3.dp)).background(Rb.Surface4)) {
                    Box(Modifier.fillMaxWidth(minOf(1f, v / 900f)).height(6.dp).clip(RoundedCornerShape(3.dp)).background(colors[i]))
                }
                Spacer(Modifier.size(10.dp))
                Text("$v", color = Rb.Text2, fontFamily = FontFamily.Monospace, fontSize = 12.sp, modifier = Modifier.width(40.dp))
            }
        }
    }
}
