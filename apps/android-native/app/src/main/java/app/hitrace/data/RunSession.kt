package app.hitrace.data

// Passes the finished run track between Running → Summary → Forge screens (nav-scoped, simple).
object RunSession {
    var track: TrackDto? = null
    var forged: Sword? = null
    /** Personal bests the just-finished run set; consumed by the forge/summary screen. */
    var records: RunRecords = RunRecords()
    /** Weekly-goal payout from the just-finished run, if it crossed the line. */
    var weeklyGoal: WeeklyGoalResult = WeeklyGoalResult()
    /** What this run did to the neighbourhood bosses it passed through. */
    var boss: BossOutcome? = null

    /**
     * Everything about the finished run, dropped at once. Clearing only some of it is how a
     * later forge ends up wearing an earlier run's 🏆 badges.
     */
    fun clear() {
        track = null
        forged = null
        records = RunRecords()
        weeklyGoal = WeeklyGoalResult()
        boss = null
    }
}

// Keeps the in-progress workshop transform alive across Workshop → 부위 지정 → Workshop
// (navigating away disposes the screen's composition, which would otherwise reset it).
object CraftSession {
    private var swordId: String? = null
    private var pending: BladeTransform? = null

    fun remember(id: String, t: BladeTransform) { swordId = id; pending = t }
    fun take(id: String): BladeTransform? = if (swordId == id) pending else null
    fun clear() { swordId = null; pending = null }
}

// Passes the resolved match between Matching → Battle.
object PvpSession {
    var result: ResolveResp? = null
    var myName: String = "내 검"
    fun clear() { result = null }
}
