package app.hitrace.data

/**
 * Three-stage GPS noise gate: accuracy → speed (teleport) → minimum movement (standing jitter).
 * The first fix is held to a stricter accuracy so a cold fix can't anchor the whole run.
 *
 * Intent: **leave slow walking and standing alone**, discard only movement that is impossibly
 * fast or teleporting.
 * - Still / slow: [minMoveM] guards against jitter, but when the device reports actual movement
 *   ([movingSpeedMps] or more) the threshold drops to [movingMinMoveM] so a slow walk still
 *   accumulates distance.
 * - Too fast: anything over [maxSpeedMps] is a GPS spike, not a person. This is a running app;
 *   36 km/h between two fixes is not somebody's legs.
 *
 * Why this matters more here than in a plain tracker: in HitRace distance *is* currency. Ghost
 * metres from standing at a crossing turn into ore, tickets and forge score.
 *
 * Ported from the Rundex app; the comments below record failures found against real runs.
 */
class LocationFilter(
    private val maxAccuracyM: Float = 25f,
    private val firstFixMaxAccuracyM: Float = 20f,
    /** ≈36 km/h. Above this is abnormal for running/walking; vehicles are MotionGuard's job. */
    private val maxSpeedMps: Double = 10.0,
    private val minMoveM: Double = 4.0,
    private val movingMinMoveM: Double = 1.0,
    /** ≈1.4 km/h and up counts as "moving". */
    private val movingSpeedMps: Float = 0.4f,
    /** Past this gap, chaining against the old anchor is meaningless → start a new one. */
    private val maxGapMs: Long = 30_000L,
) {
    /**
     * Was the last accepted fix a *new anchor* (first fix, rebase, return from a long gap)?
     * When true the caller must not add the distance from the previous point — otherwise the
     * whole blackout gap gets counted as one straight-line sprint.
     */
    var rebasedOnLastAccept = false
        private set

    var lastAccepted: GpsPointDto? = null
        private set

    var rejectedCount = 0
        private set

    /**
     * Cut the filter chain — call at any point where "continuous movement" stops being a valid
     * assumption (resuming from pause, recovering from an error). The next fix is held to
     * cold-fix accuracy and becomes a new anchor instead of being compared against a stale one.
     */
    fun rebase() {
        lastAccepted = null
    }

    /**
     * @param speedMps device-reported speed; trusted only when [hasSpeed].
     * @return whether the fix was accepted (and [lastAccepted] advanced).
     */
    fun offer(
        lat: Double,
        lng: Double,
        accuracyM: Float,
        timeMs: Long,
        speedMps: Float = 0f,
        hasSpeed: Boolean = false,
    ): Boolean {
        val last = lastAccepted
        var rebased = false
        if (last == null) {
            if (accuracyM > firstFixMaxAccuracyM) return reject()
            rebased = true
        } else {
            val dtMs = timeMs - last.t
            if (dtMs <= 0) return reject()
            if (dtMs > maxGapMs) {
                // Long blackout (tunnel, indoors). Comparing speed against the stale anchor only
                // jams the chain — require cold-fix accuracy and accept it as a new anchor.
                if (accuracyM > firstFixMaxAccuracyM) return reject()
                rebased = true
            } else {
                if (accuracyM > maxAccuracyM) return reject()
                val dtSec = dtMs / 1000.0
                val d = RunMath.haversine(last, GpsPointDto(lat, lng, null, timeMs))
                if (d / dtSec > maxSpeedMps) return reject()
                // When the device is sure it is moving, lower the movement threshold so a slow
                // walk isn't dropped. The threshold scales with accuracy: the worse the fix, the
                // wider the jitter, so a fixed 4 m gate lets low-accuracy standing jitter pile up
                // as ghost distance. And when the device is sure it is *stopped* (Doppler speed
                // ≈ 0) the entire accuracy radius is treated as noise — the strongest guard
                // against distance accruing while someone waits at a crossing.
                val moving = hasSpeed && speedMps >= movingSpeedMps
                val stationaryConfirmed = hasSpeed && speedMps < movingSpeedMps
                val minMove = when {
                    moving -> maxOf(movingMinMoveM, accuracyM * 0.1)
                    stationaryConfirmed -> maxOf(minMoveM, accuracyM.toDouble())
                    else -> maxOf(minMoveM, accuracyM * 0.4)
                }
                if (d < minMove) return reject()
            }
        }
        rebasedOnLastAccept = rebased
        lastAccepted = GpsPointDto(lat, lng, null, timeMs)
        return true
    }

    private fun reject(): Boolean {
        rejectedCount++
        return false
    }

    fun reset() {
        lastAccepted = null
        rejectedCount = 0
        rebasedOnLastAccept = false
    }
}
