package app.hitrace.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.AppViewModel
import app.hitrace.data.Shape
import app.hitrace.ui.BladeCanvas
import app.hitrace.ui.theme.Rb

@Composable
fun LoginScreen(vm: AppViewModel) {
    val error by vm.error.collectAsState()
    var handle by remember { mutableStateOf("demo") }
    // Scrollable + a hero that scales with the window: on a small screen at a large font
    // scale the sign-in button would otherwise sit below the fold, unreachable.
    val heroHeight = (LocalConfiguration.current.screenHeightDp * 0.30f).coerceIn(150f, 300f).dp
    Column(
        Modifier.fillMaxSize().background(Rb.Bg).verticalScroll(rememberScrollState())
            .safeDrawingPadding().padding(horizontal = 28.dp, vertical = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        BladeCanvas(
            shape = Shape(style = "double_edge", trueDoubleEdge = true),
            rarity = "LEGEND",
            glow = true,
            modifier = Modifier.size(heroHeight * 0.47f, heroHeight),
        )
        Text("RUN → BLADE", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 12.sp, letterSpacing = 3.sp)
        Text(
            "달린 경로가\n검이 된다",
            color = Rb.Text, fontSize = 30.sp, fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center, lineHeight = 38.sp,
            modifier = Modifier.padding(top = 10.dp),
        )
        Text(
            "러닝 기록을 무기로 주조하고, 광석으로 강화해\n자동전투로 겨루는 러닝 RPG.",
            color = Rb.Text3, fontSize = 14.sp, textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 10.dp, bottom = 28.dp),
        )
        OutlinedTextField(
            value = handle,
            onValueChange = { handle = it.take(20) },
            label = { Text("러너 이름", color = Rb.Muted, fontSize = 12.sp) },
            singleLine = true,
            textStyle = LocalTextStyle.current.copy(color = Rb.Text, fontSize = 15.sp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Rb.Gold,
                unfocusedBorderColor = Rb.Line,
                cursorColor = Rb.Gold,
            ),
            modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
        )
        Button(
            onClick = { vm.login(handle.trim().ifBlank { "demo" }) },
            modifier = Modifier.fillMaxWidth().height(54.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Rb.Gold, contentColor = Rb.Screen),
        ) {
            Text(
                if (handle.trim().equals("demo", true)) "데모로 시작하기" else "시작하기",
                fontWeight = FontWeight.Bold, fontSize = 16.sp,
            )
        }
        if (error != null) {
            Text(error!!, color = Rb.Red, fontSize = 12.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 12.dp))
        }
        Text("네이티브 · Kotlin + Jetpack Compose", color = Rb.Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 14.dp))
    }
}
