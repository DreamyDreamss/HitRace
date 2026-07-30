package app.hitrace.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.data.ApiClient
import app.hitrace.data.MeResp
import app.hitrace.ui.rememberLoad
import app.hitrace.ui.theme.Rb

/** 코스 라이벌 — best forge score per runner on one course. Re-running the same route is worth it. */
@Composable
fun CourseBoardScreen(me: MeResp, courseHash: String, onBack: () -> Unit) {
    val rows = rememberLoad(courseHash) { ApiClient.api.courseBoard(courseHash) }
    val title = if (courseHash.startsWith("treadmill")) "실내 코스" else "코스 라이벌"

    Column(
        Modifier.fillMaxSize().background(Rb.Bg).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        ScreenHeader("도감", onBack) {
            Text(title, color = Rb.Text, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        }
        Text(
            "이 코스를 달린 러너들의 최고 주조 스코어입니다. 같은 길을 더 잘 달리면 순위가 오릅니다.",
            color = Rb.Text3, fontSize = 12.sp, lineHeight = 18.sp,
        )

        when {
            rows == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("불러오는 중…", color = Rb.Muted, fontSize = 13.sp)
            }
            rows.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("아직 이 코스의 기록이 없습니다.", color = Rb.Text3, fontSize = 14.sp)
            }
            else -> {
                Eyebrow("LEADERBOARD")
                RbCard {
                    LazyColumn {
                        items(rows) { r ->
                            val mine = r.userId == me.user.id
                            Row(
                                Modifier.fillMaxWidth()
                                    .background(if (mine) Rb.Gold.copy(alpha = 0.06f) else Rb.Surface2)
                                    .padding(horizontal = 14.dp, vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(
                                    "${r.rank}",
                                    color = if (r.rank <= 3) Rb.Gold else Rb.Muted,
                                    fontFamily = FontFamily.Monospace, fontSize = 13.sp,
                                    modifier = Modifier.width(26.dp),
                                )
                                Text(
                                    if (mine) "${r.handle} (나)" else r.handle,
                                    color = if (mine) Rb.Gold2 else Rb.Text,
                                    fontSize = 14.sp,
                                    fontWeight = if (mine) FontWeight.SemiBold else FontWeight.Normal,
                                )
                                Spacer(Modifier.weight(1f))
                                Text("${r.bestScore}점", color = Rb.Text2, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
                                Spacer(Modifier.width(10.dp))
                                Text("CP ${r.bestCp}", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}
