package app.hitrace.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.AppViewModel
import app.hitrace.data.ApiClient
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
    Column(Modifier.fillMaxSize().background(Rb.Bg).verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("RUNNER", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp, letterSpacing = 2.sp)
        Text(profile?.user?.handle ?: "…", color = Rb.Text, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)

        val t = profile?.totals
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Big(Modifier.weight(1f), "누적 러닝", "${t?.totalKm ?: 0.0}", "km", accent = true)
            Big(Modifier.weight(1f), "주조한 검", "${t?.swords ?: 0}", null)
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Big(Modifier.weight(1f), "최고 CP", "${t?.bestCp ?: 0}", null, accent = true)
            Big(Modifier.weight(1f), "러닝 횟수", "${t?.runCount ?: 0}", "회")
        }

        Text("COLLECTION", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp, letterSpacing = 2.sp, modifier = Modifier.padding(top = 6.dp))
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
