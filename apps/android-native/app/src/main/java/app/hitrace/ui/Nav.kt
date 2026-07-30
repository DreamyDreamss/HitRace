package app.hitrace.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import app.hitrace.AppViewModel
import app.hitrace.data.MeResp
import app.hitrace.ui.screens.BattleScreen
import app.hitrace.ui.screens.CodexScreen
import app.hitrace.ui.screens.CollectionScreen
import app.hitrace.ui.screens.CourseBoardScreen
import app.hitrace.ui.screens.ForgeResultScreen
import app.hitrace.ui.screens.FusionScreen
import app.hitrace.ui.screens.PartsScreen
import app.hitrace.ui.screens.SeasonScreen
import app.hitrace.ui.screens.WorkshopScreen
import app.hitrace.ui.screens.MatchingScreen
import app.hitrace.ui.screens.GachaScreen
import app.hitrace.ui.screens.HomeScreen
import app.hitrace.ui.screens.ManualRunScreen
import app.hitrace.ui.screens.ProfileScreen
import app.hitrace.ui.screens.RankingScreen
import app.hitrace.ui.screens.RunningScreen
import app.hitrace.ui.screens.SummaryScreen
import app.hitrace.ui.screens.SwordDetailScreen
import app.hitrace.ui.screens.UpgradeScreen
import app.hitrace.ui.theme.Rb

object Routes {
    const val HOME = "home"
    const val COLLECTION = "collection"
    const val PVP = "pvp"
    const val RANKING = "ranking"
    const val PROFILE = "profile"
    const val RUN = "run"
    const val SUMMARY = "run/summary"
    const val FORGE = "forge"
    const val GACHA = "gacha"
    const val BATTLE = "pvp/battle"
    const val MANUAL = "run/manual"
    const val CODEX = "codex"
    const val COURSE = "course/{hash}"
    // Course hashes can contain ':' (treadmill:5) — encode for the route path.
    fun course(hash: String) = "course/" + android.net.Uri.encode(hash)
    const val SEASON = "season"
    const val SWORD = "sword/{id}"
    const val UPGRADE = "sword/{id}/upgrade"
    const val WORKSHOP = "sword/{id}/workshop"
    const val PARTS = "sword/{id}/parts"
    const val FUSION = "fusion"
    fun sword(id: String) = "sword/$id"
    fun upgrade(id: String) = "sword/$id/upgrade"
    fun workshop(id: String) = "sword/$id/workshop"
    fun parts(id: String) = "sword/$id/parts"
}

private val TAB_ROUTES = setOf(Routes.HOME, Routes.COLLECTION, Routes.PVP, Routes.RANKING, Routes.PROFILE)

private data class Tab(val route: String, val label: String, val icon: String)
private val TABS = listOf(
    Tab(Routes.HOME, "홈", "home"),
    Tab(Routes.COLLECTION, "컬렉션", "coll"),
    Tab(Routes.PVP, "대전", "pvp"),
    Tab(Routes.RANKING, "랭킹", "rank"),
    Tab(Routes.PROFILE, "프로필", "prof"),
)

@Composable
fun MainScaffold(vm: AppViewModel, me: MeResp) {
    val nav = rememberNavController()
    val entry by nav.currentBackStackEntryAsState()
    val current = entry?.destination?.route
    fun toHome() = nav.navigate(Routes.HOME) { popUpTo(Routes.HOME) { inclusive = true } }
    Column(Modifier.fillMaxSize().background(Rb.Bg).statusBarsPadding()) {
        Box(Modifier.weight(1f).fillMaxWidth()) {
            NavHost(nav, startDestination = Routes.HOME) {
                composable(Routes.HOME) {
                    HomeScreen(vm, me, onStartRun = { nav.navigate(Routes.RUN) }, onGacha = { nav.navigate(Routes.GACHA) })
                }
                composable(Routes.COLLECTION) {
                    CollectionScreen(
                        vm,
                        onOpen = { nav.navigate(Routes.sword(it)) },
                        onFusion = { nav.navigate(Routes.FUSION) },
                        onStartRun = { nav.navigate(Routes.RUN) },
                    )
                }
                composable(Routes.RANKING) { RankingScreen(vm, me) }
                composable(Routes.PROFILE) {
                    ProfileScreen(vm, onCodex = { nav.navigate(Routes.CODEX) }, onSeason = { nav.navigate(Routes.SEASON) })
                }
                composable(Routes.CODEX) {
                    CodexScreen(onBack = { nav.popBackStack() }, onCourse = { nav.navigate(Routes.course(it)) })
                }
                composable(Routes.COURSE) { entry ->
                    val hash = entry.arguments?.getString("hash").orEmpty()
                    CourseBoardScreen(me, hash, onBack = { nav.popBackStack() })
                }
                composable(Routes.SEASON) { SeasonScreen(onBack = { nav.popBackStack() }) }
                composable(Routes.PVP) { MatchingScreen(vm, me, onBattle = { nav.navigate(Routes.BATTLE) }) }
                composable(Routes.BATTLE) {
                    BattleScreen(
                        vm,
                        onDone = { toHome() },
                        onRematch = { nav.popBackStack(Routes.PVP, inclusive = false) },
                    )
                }
                composable(Routes.RUN) {
                    RunningScreen(
                        onBack = { nav.popBackStack() },
                        onFinish = { nav.navigate(Routes.SUMMARY) },
                        onManual = { nav.navigate(Routes.MANUAL) },
                    )
                }
                composable(Routes.MANUAL) {
                    ManualRunScreen(vm, onBack = { nav.popBackStack() }, onForged = { nav.navigate(Routes.FORGE) })
                }
                composable(Routes.SUMMARY) {
                    SummaryScreen(vm, onForged = { nav.navigate(Routes.FORGE) }, onSavedOnly = { toHome() })
                }
                composable(Routes.FORGE) { ForgeResultScreen(onDone = { toHome() }) }
                composable(Routes.GACHA) { GachaScreen(vm, me, onBack = { nav.popBackStack() }) }
                composable(Routes.SWORD) { entry ->
                    val id = entry.arguments?.getString("id").orEmpty()
                    SwordDetailScreen(
                        vm, me, id,
                        onBack = { nav.popBackStack() },
                        onUpgrade = { nav.navigate(Routes.upgrade(it)) },
                        onWorkshop = { nav.navigate(Routes.workshop(it)) },
                    )
                }
                composable(Routes.UPGRADE) { entry ->
                    val id = entry.arguments?.getString("id").orEmpty()
                    UpgradeScreen(vm, me, id, onBack = { nav.popBackStack() })
                }
                composable(Routes.WORKSHOP) { entry ->
                    val id = entry.arguments?.getString("id").orEmpty()
                    WorkshopScreen(
                        id,
                        onBack = { nav.popBackStack() },
                        onParts = { nav.navigate(Routes.parts(it)) },
                        onSaved = { nav.popBackStack() },
                    )
                }
                composable(Routes.PARTS) { entry ->
                    val id = entry.arguments?.getString("id").orEmpty()
                    PartsScreen(id, onBack = { nav.popBackStack() }, onSaved = { nav.popBackStack() })
                }
                composable(Routes.FUSION) {
                    FusionScreen(
                        vm, me,
                        onBack = { nav.popBackStack() },
                        onFused = { nav.navigate(Routes.sword(it)) },
                    )
                }
            }
        }
        if (current in TAB_ROUTES) BottomNav(nav)
    }
}

@Composable
private fun BottomNav(nav: NavController) {
    val entry by nav.currentBackStackEntryAsState()
    val current = entry?.destination?.route
    Row(
        // navigationBarsPadding() BEFORE height() so the gesture bar is added around the 62dp
        // row instead of eating into it (labels were being clipped).
        Modifier.fillMaxWidth().background(Rb.Screen).navigationBarsPadding().height(62.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TABS.forEach { tab ->
            val active = current == tab.route
            Column(
                Modifier.weight(1f).fillMaxHeight()
                    // Announced as a tab with its selected state, not as a bare clickable box.
                    .semantics { selected = active; role = Role.Tab }
                    .clickable {
                        if (current != tab.route) nav.navigate(tab.route) {
                            popUpTo(Routes.HOME); launchSingleTop = true
                        }
                    },
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                NavIcon(tab.icon, active)
                Text(
                    tab.label,
                    color = if (active) Rb.Gold else Rb.Muted,
                    fontSize = 10.sp,
                    fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
                    maxLines = 1,
                    softWrap = false,
                    modifier = Modifier.padding(top = 3.dp),
                )
            }
        }
    }
}

@Composable
private fun NavIcon(kind: String, active: Boolean) {
    val c = if (active) Rb.Gold else Rb.Muted
    Canvas(Modifier.size(22.dp)) {
        val s = size.minDimension
        val stroke = Stroke(width = s * 0.09f, cap = StrokeCap.Round)
        when (kind) {
            "home" -> drawPath(Path().apply {
                moveTo(s * 0.2f, s * 0.5f); lineTo(s * 0.5f, s * 0.2f); lineTo(s * 0.8f, s * 0.5f)
                moveTo(s * 0.3f, s * 0.45f); lineTo(s * 0.3f, s * 0.82f); lineTo(s * 0.7f, s * 0.82f); lineTo(s * 0.7f, s * 0.45f)
            }, c, style = stroke)
            "coll" -> drawPath(Path().apply {
                moveTo(s * 0.5f, s * 0.15f); lineTo(s * 0.62f, s * 0.4f); lineTo(s * 0.55f, s * 0.85f)
                lineTo(s * 0.45f, s * 0.85f); lineTo(s * 0.38f, s * 0.4f); close()
            }, c, style = stroke)
            "pvp" -> {
                drawLine(c, Offset(s * 0.2f, s * 0.2f), Offset(s * 0.6f, s * 0.6f), strokeWidth = s * 0.09f, cap = StrokeCap.Round)
                drawLine(c, Offset(s * 0.6f, s * 0.2f), Offset(s * 0.2f, s * 0.6f), strokeWidth = s * 0.09f, cap = StrokeCap.Round)
                drawLine(c, Offset(s * 0.65f, s * 0.65f), Offset(s * 0.85f, s * 0.85f), strokeWidth = s * 0.09f, cap = StrokeCap.Round)
            }
            "rank" -> {
                drawLine(c, Offset(s * 0.25f, s * 0.8f), Offset(s * 0.25f, s * 0.5f), strokeWidth = s * 0.11f, cap = StrokeCap.Round)
                drawLine(c, Offset(s * 0.5f, s * 0.8f), Offset(s * 0.5f, s * 0.25f), strokeWidth = s * 0.11f, cap = StrokeCap.Round)
                drawLine(c, Offset(s * 0.75f, s * 0.8f), Offset(s * 0.75f, s * 0.6f), strokeWidth = s * 0.11f, cap = StrokeCap.Round)
            }
            else -> {
                drawCircle(c, radius = s * 0.16f, center = Offset(s * 0.5f, s * 0.35f), style = stroke)
                drawPath(Path().apply {
                    moveTo(s * 0.22f, s * 0.82f); cubicTo(s * 0.22f, s * 0.6f, s * 0.78f, s * 0.6f, s * 0.78f, s * 0.82f)
                }, c, style = stroke)
            }
        }
    }
}

@Composable
fun Placeholder(title: String, code: String) {
    Column(
        Modifier.fillMaxSize().background(Rb.Bg).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(code, color = Rb.Muted, fontSize = 12.sp)
        Text(title, color = Rb.Text, fontSize = 20.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 4.dp))
        Text("이 화면은 곧 네이티브로 채워집니다", color = Rb.Text3, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
    }
}
