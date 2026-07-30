package app.hitrace.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.AppViewModel
import app.hitrace.data.CombatEvent
import app.hitrace.data.PvpSession
import app.hitrace.ui.theme.Rb
import kotlinx.coroutines.delay

private const val MAX_HP = 3000 // BALANCE.combat.hp
private const val ROUNDS = 5    // BALANCE.combat.rounds

/**
 * Spectator replay of the server's deterministic combat log: HP bars drain, the
 * struck fighter shakes, damage floats scroll. ×1/2/4 speed and skip.
 */
@Composable
fun BattleScreen(vm: AppViewModel, onDone: () -> Unit, onRematch: () -> Unit) {
    val result = PvpSession.result
    if (result == null) {
        Column(
            Modifier.fillMaxSize().background(Rb.Bg).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text("진행 중인 전투가 없습니다.", color = Rb.Text3, fontSize = 14.sp)
            Spacer(Modifier.size(16.dp))
            RbGhostButton("매칭하러 가기", onClick = onRematch)
        }
        return
    }

    val log = result.combat.log
    var step by remember { mutableIntStateOf(-1) }
    var speed by remember { mutableIntStateOf(1) }
    var done by remember { mutableStateOf(false) }

    LaunchedEffect(step, speed) {
        if (step >= log.size - 1) {
            if (!done) { done = true; vm.refresh() }
            return@LaunchedEffect
        }
        delay(900L / speed)
        step += 1
    }

    val cur: CombatEvent? = log.getOrNull(step)
    val aHp = cur?.aHp ?: MAX_HP
    val bHp = cur?.bHp ?: MAX_HP
    val round = cur?.round ?: 1

    Column(
        Modifier.fillMaxSize().background(Rb.Bg).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("전투", color = Rb.Text, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            Text("ROUND $round / $ROUNDS", color = Rb.Gold, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
        }

        FighterCard(PvpSession.myName, aHp, Rb.Gold, hitAt = if (cur?.actor == "b" && (cur.damage) > 0) step else -1)
        Text("VS", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 12.sp, modifier = Modifier.fillMaxWidth(), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        FighterCard(result.opponent.sword.name, bHp, Rb.Blue, hitAt = if (cur?.actor == "a" && (cur.damage) > 0) step else -1)

        RbCard(Modifier.weight(1f)) {
            Column(Modifier.padding(14.dp).heightIn(min = 130.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                if (step < 0) {
                    Text("전투 시작…", color = Rb.Muted, fontSize = 13.sp)
                } else {
                    // Most recent three events, freshest on top.
                    for (i in step downTo maxOf(0, step - 2)) {
                        val e = log[i]
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                e.label,
                                color = if (e.actor == "a") Rb.Gold2 else Rb.Blue,
                                fontSize = 12.5.sp,
                                modifier = Modifier.alphaFor(i == step),
                            )
                            Spacer(Modifier.weight(1f))
                            if (e.damage > 0) {
                                val mark = when (e.kind) { "crit" -> " ⚡"; "skill" -> " ✦"; else -> "" }
                                Text(
                                    "−${e.damage}$mark",
                                    color = if (e.kind == "crit" || e.kind == "skill") Rb.Red else Rb.Text2,
                                    fontFamily = FontFamily.Monospace, fontSize = 12.5.sp,
                                    modifier = Modifier.alphaFor(i == step),
                                )
                            }
                        }
                    }
                }
            }
        }

        if (!done) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                RbGhostButton("배속 ×$speed", Modifier.weight(1f)) { speed = if (speed == 1) 2 else if (speed == 2) 4 else 1 }
                RbGhostButton("스킵", Modifier.weight(1f)) { step = log.size - 1 }
            }
        } else {
            ResultPanel(
                won = result.won,
                rpDelta = result.rpDelta,
                rankRp = result.rankRp,
                onRematch = { PvpSession.clear(); onRematch() },
                onConfirm = { PvpSession.clear(); onDone() },
            )
        }
    }
}

/** Older log lines fade back so the freshest event reads first. */
private fun Modifier.alphaFor(fresh: Boolean) = this.alpha(if (fresh) 1f else 0.45f)

@Composable
private fun FighterCard(name: String, hp: Int, tone: Color, hitAt: Int) {
    var shake by remember { mutableStateOf(false) }
    LaunchedEffect(hitAt) {
        if (hitAt < 0) return@LaunchedEffect
        shake = true; delay(280); shake = false
    }
    val dx by animateFloatAsState(if (shake) 6f else 0f, tween(90), label = "shake")
    val pct by animateFloatAsState((hp.toFloat() / MAX_HP).coerceIn(0f, 1f), tween(300), label = "hp")

    RbCard(Modifier.offset(x = dx.dp)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(name, color = Rb.Text, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                Spacer(Modifier.weight(1f))
                Text("${maxOf(0, hp)} / $MAX_HP", color = Rb.Text3, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
            }
            Box(Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)).background(Rb.Surface4)) {
                Box(Modifier.fillMaxWidth(pct).height(8.dp).clip(RoundedCornerShape(4.dp)).background(tone))
            }
        }
    }
}

@Composable
private fun ResultPanel(won: Boolean, rpDelta: Int, rankRp: Int, onRematch: () -> Unit, onConfirm: () -> Unit) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(if (won) "승리" else "패배", color = if (won) Rb.Gold else Rb.Text3, fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Text(
            "${if (rpDelta > 0) "+$rpDelta" else "$rpDelta"} RP · 현재 $rankRp",
            color = if (won) Rb.Gold2 else Rb.Red, fontFamily = FontFamily.Monospace, fontSize = 15.sp,
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            RbGhostButton("다시", Modifier.weight(1f), onClick = onRematch)
            RbButton("확인", Modifier.weight(1.2f), onClick = onConfirm)
        }
    }
}
