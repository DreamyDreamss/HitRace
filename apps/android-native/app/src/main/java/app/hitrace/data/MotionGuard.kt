package app.hitrace.data

/**
 * Detects being carried by a vehicle *during* the run, so the distance can be frozen instead of
 * the whole run being thrown out half an hour later at the summary screen.
 *
 * Policy inherited from the Rundex app, where it was learned the expensive way: **step-count
 * rules must not freeze distance.** When the step sensor under-reports — phone in a pocket, in
 * an armband, batching delays — a genuine run (especially a fast one) gets scored as a vehicle
 * and the runner loses distance they actually covered. So the freeze only fires on a speed no
 * runner can produce ([hardMps] = 8 m/s ≈ 28.8 km/h) sustained for [triggerMs]. A slow city bus
 * can slip through; that is the deliberate trade — never shorten a real run.
 *
 * [windowMps] and [walking] stay available for reporting and for deciding when to resume.
 */
class MotionGuard(
    private val stepSensorAvailable: Boolean = true,
    private val windowMs: Long = 20_000,
    private val minSpanMs: Long = 8_000,
    /** Obvious vehicle regardless of steps: ≈28.8 km/h. */
    private val hardMps: Double = 8.0,
    /** Enough steps in the window to call it genuine running again. */
    private val resumeSteps: Int = 18,
    /** Suspicion must persist this long before it counts — stops the state flickering. */
    private val triggerMs: Long = 10_000,
) {
    enum class State { NORMAL, VEHICLE }

    private val moves = ArrayDeque<Pair<Long, Double>>() // (t, metres since the previous point)
    private val steps = ArrayDeque<Long>()
    private var vehicleSince = 0L

    /** Mean speed over the current window (m/s). */
    var windowMps = 0.0
        private set

    /** Enough steps observed to be confident this is running/walking. */
    var walking = false
        private set

    fun onStep(t: Long) { steps.addLast(t) }

    fun onMove(distM: Double, t: Long) { moves.addLast(t to distM) }

    fun evaluate(now: Long): State {
        while (moves.isNotEmpty() && now - moves.first().first > windowMs) moves.removeFirst()
        while (steps.isNotEmpty() && now - steps.first() > windowMs) steps.removeFirst()

        val span = if (moves.size >= 2) now - moves.first().first else 0L
        val dist = moves.sumOf { it.second }
        windowMps = if (span >= minSpanMs) dist / (span / 1000.0) else 0.0
        walking = stepSensorAvailable && steps.size >= resumeSteps

        val vehicleLike = windowMps > hardMps
        if (vehicleLike) {
            if (vehicleSince == 0L) vehicleSince = now
            if (now - vehicleSince >= triggerMs) return State.VEHICLE
        } else {
            vehicleSince = 0L
        }
        return State.NORMAL
    }

    fun reset() {
        moves.clear()
        steps.clear()
        vehicleSince = 0L
        windowMps = 0.0
        walking = false
    }
}
