package app.hitrace.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
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
import app.hitrace.data.ApiClient
import app.hitrace.data.BossStatus
import app.hitrace.ui.BossCanvas
import app.hitrace.ui.rememberLoad
import app.hitrace.ui.theme.Rb

/**
 * 동네 보스 — the neighbourhood you run in, as something to beat.
 *
 * There is no attack button here on purpose. The only way to deal damage is to go outside and
 * run; this screen exists to show what that did.
 */
@Composable
fun BossScreen(onBack: () -> Unit, onStartRun: () -> Unit, level: String = "dong") {
    val status = rememberLoad(level) { ApiClient.api.boss(level) }

    FooterPage(
        footer = {
            RbButton("러닝 시작", Modifier.fillMaxWidth(), onClick = onStartRun)
        },
    ) { viewportHeight ->
        ScreenHeader(if (level == "gu") "홈" else "홈", onBack) {
            Text(
                if (level == "gu") "구 레이드" else "동네 보스",
                color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp, letterSpacing = 2.sp,
            )
        }

        when {
            status == null -> Loading()
            status.boss == null || status.region == null -> NoBoss()
            else -> BossBody(status, viewportHeight)
        }
    }
}

@Composable
private fun Loading() {
    Box(Modifier.fillMaxWidth().height(200.dp), contentAlignment = Alignment.Center) {
        Text("보스를 찾는 중…", color = Rb.Muted, fontSize = 13.sp)
    }
}

/** Two honest reasons for an empty screen: never run yet, or ran somewhere with no boundary data. */
@Composable
private fun NoBoss() {
    Column(
        Modifier.fillMaxWidth().padding(top = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text("아직 동네가 정해지지 않았습니다", color = Rb.Text2, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        Text(
            "한 번 달리고 나면 그 동네의 보스가 나타납니다.\n(국내 행정동 기준이라 해외 러닝은 보스가 없습니다)",
            color = Rb.Text3, fontSize = 12.5.sp,
        )
    }
}

@Composable
private fun BossBody(status: BossStatus, viewportHeight: androidx.compose.ui.unit.Dp) {
    val boss = status.boss!!
    val region = status.region!!

    Text(
        listOfNotNull(region.sido, region.name).joinToString(" "),
        color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp,
    )
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
        Text(boss.name, color = Rb.Text, fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        Text("${boss.tier}단계", color = Rb.Gold, fontFamily = FontFamily.Monospace, fontSize = 14.sp)
    }
    // The tactical line — the whole reason to look at this screen before deciding when to run.
    if (boss.element != "none") {
        val counter = counterOf(boss.element)
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            ElementChip(boss.element)
            Text(
                "  ${elementLabel(counter)} 속성 검이 유리 — ${elementWeather(counter)}에 뛰세요",
                color = Rb.Text3, fontSize = 11.5.sp,
            )
        }
    }

    Box(Modifier.fillMaxWidth().height((viewportHeight * 0.30f).coerceIn(160.dp, 260.dp)), contentAlignment = Alignment.Center) {
        BossCanvas(boss.seed, boss.tier, Modifier.fillMaxSize())
    }

    // HP is the headline: how close the neighbourhood is.
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("HP", color = Rb.Muted, fontSize = 12.sp)
            Spacer(Modifier.weight(1f))
            Text(
                "%,d / %,d".format(boss.hp, boss.maxHp),
                color = Rb.Text2, fontFamily = FontFamily.Monospace, fontSize = 12.sp,
            )
        }
        Box(Modifier.fillMaxWidth().height(12.dp).clip(RoundedCornerShape(6.dp)).background(Rb.Surface4)) {
            Box(
                Modifier.fillMaxWidth(boss.hpFraction).height(12.dp)
                    .clip(RoundedCornerShape(6.dp)).background(Rb.Red),
            )
        }
        Text(
            "참가 ${boss.participants}명 · 남은 HP ${(boss.hpFraction * 100).toInt()}%",
            color = Rb.Text3, fontSize = 12.sp,
        )
    }

    // The line that makes the crowd mechanic legible instead of a hidden formula.
    Text(
        "같이 뛰는 사람이 늘수록 한 사람이 넣어야 할 몫은 줄어듭니다.",
        color = Rb.Muted, fontSize = 11.5.sp,
    )

    if (status.leaderboard.isNotEmpty()) {
        Eyebrow("기여 순위")
        RbCard {
            Column(Modifier.padding(vertical = 6.dp)) {
                status.leaderboard.take(10).forEach { c ->
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 7.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "${c.rank}",
                            color = if (c.rank <= 3) Rb.Gold else Rb.Muted,
                            fontFamily = FontFamily.Monospace, fontSize = 12.sp,
                            modifier = Modifier.width(26.dp),
                        )
                        Text(c.handle, color = Rb.Text2, fontSize = 13.sp, modifier = Modifier.weight(1f))
                        Text(
                            "%,d".format(c.damage),
                            color = Rb.Text, fontFamily = FontFamily.Monospace, fontSize = 12.sp,
                        )
                        Text(
                            " (${c.runs}회)",
                            color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 10.sp,
                        )
                    }
                }
            }
        }
    }
    Spacer(Modifier.height(4.dp))
}

/** Which element beats [element] — the answer the boss screen exists to give. */
private fun counterOf(element: String): String = when (element) {
    "ice" -> "fire"
    "wind" -> "ice"
    "water" -> "wind"
    "fire" -> "water"
    else -> "none"
}
