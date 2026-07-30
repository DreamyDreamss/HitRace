package app.hitrace.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hitrace.AppViewModel
import app.hitrace.data.ApiClient
import app.hitrace.data.ENGRAVING_CATALOG
import app.hitrace.data.EngraveBody
import app.hitrace.data.MeResp
import app.hitrace.data.Sword
import app.hitrace.data.activeSynergyNames
import app.hitrace.ui.BladeCanvas
import app.hitrace.ui.theme.Rb
import kotlinx.coroutines.launch

@Composable
fun SwordDetailScreen(
    vm: AppViewModel,
    me: MeResp,
    swordId: String,
    onBack: () -> Unit,
    onUpgrade: (String) -> Unit,
    onWorkshop: (String) -> Unit = {},
) {
    val scope = rememberCoroutineScope()
    var sword by remember { mutableStateOf<Sword?>(null) }
    var reload by remember { mutableIntStateOf(0) }
    var busy by remember { mutableStateOf(false) }
    var msg by remember { mutableStateOf<String?>(null) }
    var pickSlot by remember { mutableStateOf<Int?>(null) }

    LaunchedEffect(swordId, reload) {
        sword = runCatching { ApiClient.api.sword(swordId) }.getOrNull()
    }

    val s = sword
    if (s == null) {
        Box(Modifier.fillMaxSize().background(Rb.Bg), contentAlignment = Alignment.Center) {
            Text("검 여는 중…", color = Rb.Muted, fontSize = 13.sp)
        }
        return
    }
    val c = Rb.rarityColor(s.rarity)
    val equipped = me.user.equippedSwordId == s.id

    Box(Modifier.fillMaxSize().background(Rb.Bg)) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            ScreenHeader("보관함", onBack) {
                if (equipped) Text("장착 중", color = Rb.Gold, fontSize = 13.sp)
            }

            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                BladeCanvas(s.shape, s.rarity, glow = true, modifier = Modifier.size(92.dp, 220.dp))
                Spacer(Modifier.size(16.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RarityChip(s.rarity, s.plus)
                        if (s.shape.trueDoubleEdge) {
                            Spacer(Modifier.size(8.dp))
                            Text("眞 양날", color = Rb.Gold2, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
                        }
                    }
                    Text(s.name, color = Rb.Text, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                    Text("CP ${s.cp}", color = c, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
                    Text(s.shape.style, color = Rb.Muted, fontFamily = FontFamily.Monospace, fontSize = 10.5.sp)
                }
            }

            StatBarsCard(s.stats)

            // ── Engravings ──────────────────────────────────────────────────
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Eyebrow("ENGRAVINGS")
                Spacer(Modifier.weight(1f))
                activeSynergyNames(s.engravings).forEach {
                    Text("✦ $it", color = Rb.Purple, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
                }
            }
            if (s.engravings.isEmpty()) {
                Text("이 등급은 각인 슬롯이 없습니다.", color = Rb.Muted, fontSize = 12.5.sp)
            } else {
                // Fixed row height — one slot shouldn't balloon into a full-width square.
                Row(Modifier.fillMaxWidth().height(112.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    s.engravings.forEachIndexed { i, e ->
                        Column(
                            Modifier.weight(1f).fillMaxHeight().clip(RoundedCornerShape(14.dp))
                                .background(Rb.Surface2).border(1.dp, Rb.Line, RoundedCornerShape(14.dp))
                                .clickable { pickSlot = i }.padding(6.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center,
                        ) {
                            if (e != null) {
                                Text(e.name, color = Rb.Text, fontSize = 12.sp, fontWeight = FontWeight.Medium, maxLines = 2)
                                Spacer(Modifier.size(4.dp))
                                RarityChip(e.rarity, 0)
                            } else {
                                Text("+", color = Rb.Muted, fontSize = 20.sp)
                                Text("각인", color = Rb.Muted, fontSize = 10.sp)
                            }
                        }
                    }
                }
            }

            msg?.let { Text(it, color = Rb.Gold2, fontSize = 13.sp) }

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                RbButton("강화하기", Modifier.weight(1.6f)) { onUpgrade(s.id) }
                RbGhostButton("공방", Modifier.weight(1f)) { onWorkshop(s.id) }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                RbGhostButton("장착", Modifier.weight(1f), enabled = !equipped && !busy) {
                    busy = true
                    scope.launch {
                        runCatching { ApiClient.api.equip(s.id) }
                            .onSuccess { msg = "장착했습니다." ; vm.refresh() }
                            .onFailure { msg = "장착에 실패했습니다." }
                        busy = false
                    }
                }
                RbGhostButton("분해", Modifier.weight(1f), enabled = !equipped && !busy, tone = Rb.Red) {
                    busy = true
                    scope.launch {
                        runCatching { ApiClient.api.dismantle(app.hitrace.data.DismantleBody(listOf(s.id))) }
                            .onSuccess { vm.refresh(); onBack() }
                            .onFailure { msg = "분해에 실패했습니다." }
                        busy = false
                    }
                }
            }
            if (equipped) Text("장착 중인 검은 분해할 수 없습니다.", color = Rb.Muted, fontSize = 11.sp)
            Spacer(Modifier.height(8.dp))
        }

        // ── Engraving picker sheet ──────────────────────────────────────────
        val slot = pickSlot
        if (slot != null) {
            Box(
                Modifier.fillMaxSize().background(Rb.Bg.copy(alpha = 0.72f)).clickable { pickSlot = null },
                contentAlignment = Alignment.BottomCenter,
            ) {
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp))
                        .background(Rb.Screen).border(1.dp, Rb.Line, RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp))
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text("각인 선택 · 슬롯 ${slot + 1}", color = Rb.Text, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.weight(1f))
                        Text("보유 각인석 ${me.wallet.engraveStone}", color = Rb.Purple, fontSize = 12.sp)
                    }
                    ENGRAVING_CATALOG.forEach { def ->
                        val afford = me.wallet.engraveStone >= def.cost && !busy
                        Row(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Rb.Surface2)
                                .border(1.dp, Rb.Line, RoundedCornerShape(12.dp))
                                .clickable(enabled = afford) {
                                    busy = true
                                    scope.launch {
                                        runCatching { ApiClient.api.engrave(s.id, EngraveBody(slot, def.id)) }
                                            .onSuccess { res ->
                                                pickSlot = null
                                                msg = res.synergies.firstOrNull()?.let { "${it.name} 세트 발동!" } ?: "각인 완료."
                                                vm.refresh(); reload++
                                            }
                                            .onFailure { msg = "각인석이 부족하거나 각인에 실패했습니다." }
                                        busy = false
                                    }
                                }
                                .padding(horizontal = 14.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RarityChip(def.rarity, 0)
                            Spacer(Modifier.size(10.dp))
                            Text(def.name, color = if (afford) Rb.Text else Rb.Muted, fontSize = 13.5.sp)
                            Spacer(Modifier.weight(1f))
                            Text("각인석 ${def.cost}", color = Rb.Purple, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                        }
                    }
                    Spacer(Modifier.height(6.dp))
                }
            }
        }
    }
}
