package app.hitrace.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
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
import app.hitrace.ui.BladeCanvas
import app.hitrace.ui.theme.Rb

/**
 * The reward reveal: the run, as a sword.
 *
 * Laid out with [FooterPage] because this screen keeps growing — record badges, then the weekly
 * goal banner, then two-line stat rows — and it eventually grew taller than the phone, which put
 * its only button below the edge with no scroll and no bottom nav to escape by. The actions now
 * live in a footer that is measured before the body, so no future addition can hide them.
 */
@Composable
fun ForgeResultScreen(onDone: () -> Unit, onOpenSword: (String) -> Unit) {
    val sword = RunSession.forged
    if (sword == null) {
        // Navigating from composition is a side effect; it belongs in an effect.
        LaunchedEffect(Unit) { onDone() }
        return
    }
    val c = Rb.rarityColor(sword.rarity)
    val reveal = remember { Animatable(0f) }
    LaunchedEffect(Unit) { reveal.animateTo(1f, tween(750)) }

    // Whichever way the player leaves — either button or the system back key — the finished run
    // is done with, so it is cleared in exactly one place.
    fun finish() {
        RunSession.clear()
        onDone()
    }
    BackHandler { finish() }

    FooterPage(
        horizontalAlignment = Alignment.CenterHorizontally,
        footer = {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                RbGhostButton("내 검 보기", Modifier.weight(1f)) {
                    val id = sword.id
                    RunSession.clear()
                    onOpenSword(id)
                }
                RbButton("완료", Modifier.weight(1.2f)) { finish() }
            }
        },
    ) { viewportHeight ->
        Text(
            "FORGED · ${sword.rarity}",
            color = c, fontFamily = FontFamily.Monospace, fontSize = 12.sp, letterSpacing = 3.sp,
        )
        Text("달린 경로가 검이 되었습니다", color = Rb.Text3, fontSize = 13.sp)
        // Records earned by the run that made this blade — the running half of the reward.
        RecordBadges(RunSession.records)
        GoalBanner(RunSession.weeklyGoal)
        BossDamage(RunSession.boss)

        // Sized from the space the body actually got, so the blade is never the reason something
        // else is pushed off. Aspect ratio held at the original 150:320.
        val bladeHeight = (viewportHeight * 0.40f).coerceIn(180.dp, 320.dp)
        BladeCanvas(
            sword.shape, sword.rarity,
            // Size first, then the reveal's scale/alpha — swapping the order would change what
            // the animation's graphics layer wraps.
            modifier = Modifier
                .height(bladeHeight)
                .width(bladeHeight * (150f / 320f))
                .scale(0.6f + 0.4f * reveal.value)
                .alpha(reveal.value),
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (sword.shape.trueDoubleEdge) {
                Text("眞 양날", color = Rb.Gold2, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
                Spacer(Modifier.size(8.dp))
            }
            Text("CP ${sword.cp}", color = c, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
        }
        StatBarsCard(sword.stats)
    }
}

/** Weekly goal crossed by this run — the payout is shown where the reward lands. */
@Composable
private fun GoalBanner(g: app.hitrace.data.WeeklyGoalResult) {
    if (!g.achieved) return
    Column(
        Modifier.clip(RoundedCornerShape(12.dp)).background(Rb.Green.copy(alpha = 0.12f))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("🎉 이번 주 목표 ${g.goalKm}km 달성", color = Rb.Green, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        Text(
            "이번 주 %.1fkm · 보너스 철광석 %d · 티켓 %d".format(g.weekKm, g.bonus.ore, g.bonus.forgeTicket),
            color = Rb.Text3, fontFamily = FontFamily.Monospace, fontSize = 11.sp,
        )
    }
}

/**
 * 🏆 badges for whatever personal bests this run beat. Silent when there are none.
 *
 * FlowRow, not Row: a run that beats all five records would otherwise run off the side of a
 * narrow screen — the same overflow as the one this screen was fixed for, turned sideways.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RecordBadges(r: app.hitrace.data.RunRecords) {
    if (!r.any) return
    val labels = buildList {
        if (r.firstRun) add("첫 러닝")
        if (r.longestDistance) add("최장 거리")
        if (r.fastestPace) add("최고 페이스")
        if (r.longestDuration) add("최장 시간")
        if (r.biggestClimb) add("최대 고도")
    }
    FlowRow(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        labels.forEach { label ->
            Text(
                "🏆 $label",
                color = Rb.Gold, fontSize = 11.sp,
                modifier = Modifier.clip(RoundedCornerShape(999.dp))
                    .background(Rb.Gold.copy(alpha = 0.13f))
                    .padding(horizontal = 10.dp, vertical = 5.dp),
            )
        }
    }
}

/**
 * What this run did to the neighbourhoods it crossed.
 *
 * Shown here rather than only on the boss screen: the damage is a consequence of the run that was
 * just finished, and this is the moment the runner is still thinking about it.
 */
@Composable
private fun BossDamage(outcome: app.hitrace.data.BossOutcome?) {
    val hits = outcome?.hits?.takeIf { it.isNotEmpty() } ?: return
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Rb.Surface2)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text("동네 보스", color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 10.sp, letterSpacing = 2.sp)
        hits.forEach { hit ->
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    hit.boss.name,
                    color = if (hit.killed) Rb.Gold else Rb.Text2,
                    fontSize = 12.5.sp,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    "%,d".format(hit.damage),
                    color = Rb.Red, fontFamily = FontFamily.Monospace, fontSize = 12.5.sp,
                )
            }
            if (hit.killed) {
                Text(
                    "★ 격파! 마력석 ${hit.manaStone}",
                    color = Rb.Gold, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}
