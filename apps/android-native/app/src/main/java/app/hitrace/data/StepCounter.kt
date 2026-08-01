package app.hitrace.data

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager

/**
 * Real cadence from the step detector.
 *
 * This matters more than it looks: cadence stability becomes the sword's **durability**. The app
 * used to synthesise the samples with a sine wave, which meant every real run produced the same
 * durability and one of the four stats was decorative. Either we measure it or we say we don't
 * have it — inventing it is the one option that makes the game dishonest.
 *
 * TYPE_STEP_DETECTOR fires once per step and needs no special permission below Android 10;
 * from 10 onward it is gated by ACTIVITY_RECOGNITION, which the caller must hold. If the sensor
 * or the permission is missing, [cadenceSamples] is empty and the server scores without it.
 */
object StepCounter : SensorEventListener {

    private var manager: SensorManager? = null
    private var sensor: Sensor? = null

    /**
     * Process-wide rather than owned by the service: the run controller has to read the samples
     * at the moment the run ends, and going through the service would race the service's own
     * shutdown.
     */
    fun bind(context: Context) {
        if (manager != null) return
        manager = context.applicationContext.getSystemService(SensorManager::class.java)
        sensor = runCatching { manager?.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR) }.getOrNull()
    }

    /** Timestamps (ms) of individual steps, in order. */
    private val steps = ArrayList<Long>()

    val available: Boolean get() = sensor != null

    @Volatile
    private var listening = false

    fun start() {
        val s = sensor ?: return
        if (listening) return
        listening = runCatching {
            manager?.registerListener(this, s, SensorManager.SENSOR_DELAY_NORMAL) == true
        }.getOrDefault(false)
    }

    fun stop() {
        if (!listening) return
        runCatching { manager?.unregisterListener(this) }
        listening = false
    }

    fun reset() {
        synchronized(steps) { steps.clear() }
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (event.sensor.type != Sensor.TYPE_STEP_DETECTOR) return
        // The detector can report several steps in one event after a batch.
        val count = event.values.firstOrNull()?.toInt() ?: 1
        val now = System.currentTimeMillis()
        synchronized(steps) { repeat(count.coerceIn(1, 10)) { steps.add(now) } }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    /** Steps per minute right now, over the last [windowMs]. 0 when there isn't enough data. */
    fun currentCadence(nowMs: Long = System.currentTimeMillis(), windowMs: Long = 20_000): Double {
        val recent = synchronized(steps) { steps.count { nowMs - it <= windowMs } }
        if (recent < 4) return 0.0
        return recent * 60_000.0 / windowMs
    }

    /**
     * One cadence sample per track point, so the samples line up with the points the server
     * scores. A point with no steps around it yields 0 and the engine ignores it.
     */
    fun samplesFor(points: List<GpsPointDto>, windowMs: Long = 20_000): List<Double> {
        val snapshot = synchronized(steps) { steps.toList() }
        if (snapshot.isEmpty()) return emptyList()
        return points.map { p ->
            val from = p.t - windowMs / 2
            val to = p.t + windowMs / 2
            val n = snapshot.count { it in from..to }
            if (n < 4) 0.0 else n * 60_000.0 / windowMs
        }
    }

    fun totalSteps(): Int = synchronized(steps) { steps.size }
}
