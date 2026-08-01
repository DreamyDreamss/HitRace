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

    /**
     * The GPS is reporting, but the fixes are too poor to record. Without this the runner just
     * watches the distance sit at 0.00 with no idea why — and the filter is *supposed* to drop
     * those fixes, so it isn't an error state, only one worth naming.
     */
    private val _weakSignal = MutableStateFlow(false)
    val weakSignal: StateFlow<Boolean> = _weakSignal.asStateFlow()

    private var consecutiveRejects = 0

    /**
     * The run was auto-paused because the movement stopped looking like running. Said out loud
     * so an auto-pause is never mistaken for the app failing.
     */
    private val _vehiclePaused = MutableStateFlow(false)
    val vehiclePaused: StateFlow<Boolean> = _vehiclePaused.asStateFlow()

    fun noteVehiclePause() { _vehiclePaused.value = true }

    fun clearVehiclePause() { _vehiclePaused.value = false }

    /** Wall-clock start, used only until two points exist (then the point timeline wins). */
    @Volatile var startMs: Long = 0L
        private set

    fun begin(simulated: Boolean) {
        _points.value = emptyList()
        _vehiclePaused.value = false
        cadenceSamples = emptyList()
        _cadenceNow.value = 0.0
        consecutiveRejects = 0
        _weakSignal.value = false
        _simulated.value = simulated
        _gpsOk.value = simulated
        startMs = System.currentTimeMillis()
        _status.value = RunStatus.RUNNING
    }

    fun add(point: GpsPointDto) {
        _gpsOk.value = true
        consecutiveRejects = 0
        if (_weakSignal.value) _weakSignal.value = false
        _points.value = _points.value + point
    }

    /** A fix arrived but the filter rejected it — real signal, unusable quality. */
    fun noteFix() {
        _gpsOk.value = true
        // ~10 fixes at 1-2s apart is 10-20 seconds of nothing recorded; that is worth saying.
        if (++consecutiveRejects >= 10) _weakSignal.value = true
    }

    fun setStatus(status: RunStatus) { _status.value = status }

    fun clear() {
        _points.value = emptyList()
        _vehiclePaused.value = false
        cadenceSamples = emptyList()
        _cadenceNow.value = 0.0
        consecutiveRejects = 0
        _weakSignal.value = false
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

    /**
     * Measured cadence, one sample per point. Empty when the device has no step detector or the
     * permission was refused — the server then scores without it rather than being told a
     * number nobody measured.
     */
    @Volatile
    private var cadenceSamples: List<Double> = emptyList()

    fun setCadence(samples: List<Double>) { cadenceSamples = samples }

    private val _cadenceNow = MutableStateFlow(0.0)
    /** Live cadence for the running screen; 0 when unmeasured. */
    val cadenceNow: StateFlow<Double> = _cadenceNow.asStateFlow()

    fun setCadenceNow(spm: Double) { _cadenceNow.value = spm }

    /**
     * The finished track, ready to submit.
     *
     * Cadence is sent only if it was actually measured, and heart rate is not sent at all — this
     * build has no source for it. Both used to be synthesised here, which meant the server was
     * deriving a sword's durability from a sine wave.
     */
    fun track(): TrackDto {
        val pts = _points.value
        val cadence = cadenceSamples.takeIf { it.size == pts.size && it.any { v -> v > 0 } }
        return TrackDto(points = pts, cadence = cadence, heartRate = null)
    }
}
