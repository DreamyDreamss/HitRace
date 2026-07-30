package app.hitrace.data

// Passes the finished run track between Running → Summary → Forge screens (nav-scoped, simple).
object RunSession {
    var track: TrackDto? = null
    var forged: Sword? = null
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
