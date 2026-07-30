package app.hitrace.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class RunStatus { IDLE, RUNNING, PAUSED, FINISHED }

/**
 * Process-wide state of the run in progress.
 *
 * The foreground service writes here, the UI reads here. Keeping it out of the composable means a
 * run survives navigation, the app being backgrounded, and the screen turning off — the tracking
 * itself lives in [app.hitrace.service.RunTrackingService].
 */
object RunTracker {
    private val _points = MutableStateFlow<List<GpsPointDto>>(emptyList())
    val points: StateFlow<List<GpsPointDto>> = _points.asStateFlow()

    private val _status = MutableStateFlow(RunStatus.IDLE)
    val status: StateFlow<RunStatus> = _status.asStateFlow()

    private val _gpsOk = MutableStateFlow(false)
    val gpsOk: StateFlow<Boolean> = _gpsOk.asStateFlow()

    private val _simulated = MutableStateFlow(false)
    val simulated: StateFlow<Boolean> = _simulated.asStateFlow()

    /** Wall-clock start, used only until two points exist (then the point timeline wins). */
    @Volatile var startMs: Long = 0L
        private set

    fun begin(simulated: Boolean) {
        _points.value = emptyList()
        _simulated.value = simulated
        _gpsOk.value = simulated
        startMs = System.currentTimeMillis()
        _status.value = RunStatus.RUNNING
    }

    fun add(point: GpsPointDto) {
        _gpsOk.value = true
        _points.value = _points.value + point
    }

    fun setStatus(status: RunStatus) { _status.value = status }

    fun clear() {
        _points.value = emptyList()
        _status.value = RunStatus.IDLE
        _gpsOk.value = false
        _simulated.value = false
    }

    /** Distance/duration/pace of the run so far — the same math the server scores with. */
    fun metrics(): RunMath.Metrics {
        val pts = _points.value
        if (pts.size < 2) {
            val dur = if (pts.isEmpty()) 0.0 else (System.currentTimeMillis() - startMs) / 1000.0
            return RunMath.Metrics(0.0, dur, 0.0, 0.0)
        }
        return RunMath.metrics(pts)
    }

    /** The finished track, ready to submit. Cadence/HR are synthesised (no sensor on this build). */
    fun track(): TrackDto {
        val pts = _points.value
        return TrackDto(
            points = pts,
            cadence = pts.indices.map { 170.0 + kotlin.math.sin(it * 0.6) * 3 },
            heartRate = pts.indices.map { if (pts.isNotEmpty() && it.toDouble() / pts.size < 0.65) 152.0 else 120.0 },
            maxHeartRate = 190,
        )
    }
}
