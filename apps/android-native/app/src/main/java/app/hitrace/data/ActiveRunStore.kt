package app.hitrace.data

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import java.io.File

/**
 * A periodic snapshot of the run in progress.
 *
 * The foreground service usually survives, but some OEMs kill it anyway, and an hour of running
 * living only in a `StateFlow` means one kill erases it with nothing to show the runner. The
 * snapshot costs a small file write every so often and turns that into "이어서 기록할까요?".
 */
@Serializable
data class ActiveRunSnapshot(
    val points: List<GpsPointDto>,
    val startMs: Long,
    val savedAtMs: Long,
)

class ActiveRunStore(dir: File) {
    private val file = File(dir.apply { mkdirs() }, "active_run.json")

    fun save(points: List<GpsPointDto>, startMs: Long, nowMs: Long) {
        if (points.isEmpty()) return
        runCatching {
            file.writeText(ApiClient.json.encodeToString(ActiveRunSnapshot(points, startMs, nowMs)))
        }
    }

    /**
     * The snapshot, if there is one worth offering. A run abandoned days ago is noise, and a
     * couple of points is not a run — both are cleared rather than offered.
     */
    fun restorable(nowMs: Long): ActiveRunSnapshot? {
        val snap = runCatching {
            if (file.exists()) ApiClient.json.decodeFromString<ActiveRunSnapshot>(file.readText()) else null
        }.getOrNull() ?: return null
        val stale = nowMs - snap.savedAtMs > MAX_AGE_MS
        if (stale || snap.points.size < MIN_POINTS) { clear(); return null }
        return snap
    }

    fun clear() {
        runCatching { file.delete() }
    }

    companion object {
        private const val MAX_AGE_MS = 12L * 60 * 60 * 1000 // 12 hours
        private const val MIN_POINTS = 5

        fun of(context: Context) = ActiveRunStore(File(context.filesDir, "data"))
    }
}
