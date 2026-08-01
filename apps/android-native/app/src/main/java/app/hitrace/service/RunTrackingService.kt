package app.hitrace.service

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import app.hitrace.MainActivity
import app.hitrace.data.ActiveRunStore
import app.hitrace.data.GpsPointDto
import app.hitrace.data.GpsSmoother
import app.hitrace.data.LocationFilter
import app.hitrace.data.MotionGuard
import app.hitrace.data.RunMath
import app.hitrace.data.RunStatus
import app.hitrace.data.RunTracker
import app.hitrace.data.StepCounter
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Keeps the run recording while the app is backgrounded or the screen is off.
 *
 * A `location`-typed foreground service is the only way Android will keep delivering GPS updates
 * in that state; the ongoing notification is the price of admission (and shows live distance/pace).
 * Started from a visible screen, so no ACCESS_BACKGROUND_LOCATION is needed.
 */
class RunTrackingService : Service() {

    companion object {
        const val ACTION_START = "app.hitrace.run.START"
        const val ACTION_SIMULATE = "app.hitrace.run.SIMULATE"
        const val ACTION_PAUSE = "app.hitrace.run.PAUSE"
        const val ACTION_RESUME = "app.hitrace.run.RESUME"
        const val ACTION_STOP = "app.hitrace.run.STOP"

        private const val CHANNEL_ID = "run_tracking"
        private const val NOTIFICATION_ID = 42
        private const val SNAPSHOT_EVERY_MS = 15_000L
        /** Wake-lock ceiling. Longer than any plausible run, short enough to self-heal. */
        private const val MAX_RUN_MS = 8L * 60 * 60 * 1000

        fun send(context: Context, action: String) {
            val intent = Intent(context, RunTrackingService::class.java).setAction(action)
            if (action == ACTION_STOP) context.startService(intent)
            else ContextCompat.startForegroundService(context, intent)
        }
    }

    private val scope = CoroutineScope(SupervisorJob())
    private val fused by lazy { LocationServices.getFusedLocationProviderClient(this) }
    private var callback: LocationCallback? = null

    // Raw fused fixes are not fit to score a run with: a cold fix lands a kilometre away, and
    // standing at a crossing drifts enough to accrue distance that becomes ore and forge score.
    // The gate discards what isn't a person moving; the smoother takes the zig-zag out of what's
    // left. Both are per-run state, so they reset with each start.
    private val filter = LocationFilter()
    private val smoother = GpsSmoother()
    private val activeRunStore by lazy { ActiveRunStore.of(this) }
    private val motion = MotionGuard()
    private var wakeLock: PowerManager.WakeLock? = null
    private var simJob: Job? = null
    private var notifyJob: Job? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                if (!hasLocationPermission()) { stopSelf(); return START_NOT_STICKY }
                if (!goForeground(location = true)) { stopSelf(); return START_NOT_STICKY }
                filter.reset(); smoother.reset(); acquireWakeLock()
                StepCounter.bind(this); StepCounter.reset(); StepCounter.start(); motion.reset()
                RunTracker.begin(simulated = false); startLocationUpdates(); startNotifyLoop()
            }
            // The simulation reads no sensors, so it must NOT claim the location type — doing so
            // throws SecurityException when location permission hasn't been granted.
            ACTION_SIMULATE -> {
                if (!goForeground(location = false)) { stopSelf(); return START_NOT_STICKY }
                RunTracker.begin(simulated = true); startSimulation(); startNotifyLoop()
            }
            // Paused means no fixes to wait for, so let the CPU sleep until resumed.
            ACTION_PAUSE -> {
                RunTracker.setStatus(RunStatus.PAUSED); stopLocationUpdates(); releaseWakeLock(); StepCounter.stop()
            }
            // Rebase on resume: the runner may have moved (or been driven) while paused, and
            // chaining across that gap would bank it as distance.
            ACTION_RESUME -> {
                filter.rebase(); smoother.reset(); acquireWakeLock(); StepCounter.start()
                motion.reset(); RunTracker.clearVehiclePause()
                RunTracker.setStatus(RunStatus.RUNNING); startLocationUpdates()
            }
            // Finishing is deliberate: the track is handed to the summary screen, so the crash
            // snapshot has nothing left to protect.
            ACTION_STOP -> { activeRunStore.clear(); stopEverything(); stopSelf() }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        stopEverything()
        scope.cancel()
        super.onDestroy()
    }

    // ── tracking ────────────────────────────────────────────────────────────────

    private fun startLocationUpdates() {
        if (RunTracker.simulated.value) return
        if (!hasLocationPermission()) return
        stopLocationUpdates()
        val req = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 2000L)
            .setMinUpdateIntervalMillis(1000L)
            .build()
        val cb = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.locations.forEach { loc -> onFix(loc) }
            }
        }
        callback = cb
        runCatching { fused.requestLocationUpdates(req, cb, mainLooper) }
    }

    /**
     * One fix, gated then smoothed. `loc.time` is the fix's own timestamp rather than wall clock,
     * so a batched delivery doesn't compress several fixes into the same instant — the server
     * derives duration and pace from these timestamps.
     */
    private fun onFix(loc: android.location.Location) {
        val t = if (loc.time > 0) loc.time else System.currentTimeMillis()
        val accuracy = if (loc.hasAccuracy()) loc.accuracy else Float.MAX_VALUE
        if (!filter.offer(loc.latitude, loc.longitude, accuracy, t, loc.speed, loc.hasSpeed())) {
            // Still worth telling the UI we have a signal — the fix was real, just not usable.
            RunTracker.noteFix()
            return
        }
        // A rebase means the previous anchor is unrelated to this one (first fix, or back from a
        // blackout). Smoothing across that boundary would drag the track toward a stale position.
        val rebased = filter.rebasedOnLastAccept
        if (rebased) smoother.reset()
        val (lat, lng) = smoother.process(
            loc.latitude, loc.longitude, accuracy, t,
            if (loc.hasSpeed()) loc.speed.toDouble() else 0.0,
        )
        val previous = RunTracker.points.value.lastOrNull()
        val point = GpsPointDto(
            lat = lat,
            lng = lng,
            ele = if (loc.hasAltitude()) loc.altitude else null,
            t = t,
            // Only mid-run rebases are gaps; the very first fix has no leg behind it.
            gap = rebased && previous != null,
        )
        if (previous != null && !point.gap) motion.onMove(RunMath.haversine(previous, point), t)
        RunTracker.add(point)

        // Being carried at 29 km/h for ten seconds is not running. Freeze here rather than
        // letting the server reject the whole run at the summary screen — half an hour later.
        if (motion.evaluate(t) == MotionGuard.State.VEHICLE && RunTracker.status.value == RunStatus.RUNNING) {
            RunTracker.setStatus(RunStatus.PAUSED)
            RunTracker.noteVehiclePause()
            stopLocationUpdates()
            releaseWakeLock()
        }
    }

    /**
     * A foreground service survives, but the CPU can still be suspended between callbacks in
     * doze. The wake lock is what makes an hour of screen-off running actually record.
     * Timed out generously so a crashed service can never hold it forever.
     */
    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        wakeLock = runCatching {
            getSystemService(PowerManager::class.java)
                .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "hitrace:run")
                .apply { setReferenceCounted(false); acquire(MAX_RUN_MS) }
        }.getOrNull()
    }

    private fun releaseWakeLock() {
        runCatching { wakeLock?.takeIf { it.isHeld }?.release() }
        wakeLock = null
    }

    private fun stopLocationUpdates() {
        callback?.let { runCatching { fused.removeLocationUpdates(it) } }
        callback = null
    }

    /** Deterministic Seoul course for emulators / no-GPS testing; ~30 min compressed. */
    private fun startSimulation() {
        simJob?.cancel()
        val startMs = RunTracker.startMs
        val cos0 = cos(37.5285 * PI / 180)
        simJob = scope.launch {
            val n = 160
            for (i in 0 until n) {
                if (RunTracker.status.value != RunStatus.RUNNING) break
                val f = i.toDouble() / (n - 1)
                val dx = f * 6000.0
                val dy = sin(f * PI * 5) * 140.0
                RunTracker.add(
                    GpsPointDto(
                        lat = 37.5285 + dy / 111320.0,
                        lng = 126.9327 + dx / (111320.0 * cos0),
                        ele = 20.0 + sin(f * PI) * 55.0,
                        t = startMs + (f * 6000 * 300).roundToInt(),
                    ),
                )
                delay(40)
            }
            RunTracker.setStatus(RunStatus.FINISHED)
        }
    }

    private fun stopEverything() {
        stopLocationUpdates()
        releaseWakeLock()
        StepCounter.stop()
        simJob?.cancel(); simJob = null
        notifyJob?.cancel(); notifyJob = null
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    }

    // ── notification ────────────────────────────────────────────────────────────

    private fun createChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "러닝 기록",
            NotificationManager.IMPORTANCE_LOW, // silent: it's a status, not an alert
        ).apply { description = "러닝 중 거리·시간을 기록합니다" }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    /**
     * Promote to a foreground service. Returns false if the platform refused — the caller then
     * stops instead of crashing (Android throws if the declared type's permissions are missing).
     */
    private fun goForeground(location: Boolean): Boolean {
        val type = when {
            Build.VERSION.SDK_INT < Build.VERSION_CODES.Q -> 0
            location -> ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            else -> ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        }
        return runCatching {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(), type)
        }.onFailure { Log.e("RunTracking", "startForeground(location=$location) refused", it) }.isSuccess
    }

    private fun hasLocationPermission() =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    /** Refresh the ongoing notification so the user sees live distance without opening the app. */
    private fun startNotifyLoop() {
        notifyJob?.cancel()
        notifyJob = scope.launch {
            var sinceSnapshot = 0L
            while (RunTracker.status.value != RunStatus.FINISHED) {
                getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification())
                // Snapshot every ~15s. Frequent enough that a kill costs almost nothing, rare
                // enough that it isn't a write every notification tick for an hour.
                RunTracker.setCadenceNow(StepCounter.currentCadence())
                sinceSnapshot += 2000
                if (sinceSnapshot >= SNAPSHOT_EVERY_MS && !RunTracker.simulated.value) {
                    sinceSnapshot = 0
                    activeRunStore.save(RunTracker.points.value, RunTracker.startMs, System.currentTimeMillis())
                }
                delay(2000)
            }
            getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification())
        }
    }

    private fun buildNotification(): Notification {
        val m = RunTracker.metrics()
        val mins = (m.durationSec / 60).toInt()
        val secs = (m.durationSec % 60).toInt()
        val paused = RunTracker.status.value == RunStatus.PAUSED
        val open = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(if (paused) "러닝 일시정지" else "러닝 기록 중")
            .setContentText(
                "%.2fkm · %d:%02d · %s".format(m.distanceKm, mins, secs, RunMath.paceLabel(m.paceSecPerKm)),
            )
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentIntent(open)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
}
