package app.hitrace.data

import android.content.Context
import kotlinx.serialization.encodeToString
import java.io.File

/**
 * Runs that finished but haven't reached the server yet.
 *
 * A finished run only exists in memory until the server accepts it, so a dead signal at the end
 * of an hour's running used to erase the whole thing. The payload goes to disk first and is
 * retried whenever the app is next in a position to talk to the server.
 *
 * Safe to retry: the server keys a run by its first sample's timestamp, so a submission that
 * actually succeeded before the connection dropped comes back as a duplicate rather than a
 * second sword.
 */
class PendingRunStore(dir: File) {
    private val file = File(dir.apply { mkdirs() }, "pending_runs.json")

    /** The queued run plus what the runner chose to do with it. */
    private fun read(): MutableList<RunBody> =
        runCatching {
            if (!file.exists()) mutableListOf()
            else ApiClient.json.decodeFromString<MutableList<RunBody>>(file.readText())
        }.getOrElse { mutableListOf() }

    private fun write(items: List<RunBody>) {
        runCatching { file.writeText(ApiClient.json.encodeToString(items)) }
    }

    /** Identity of a queued run — the same key the server uses, so enqueueing twice is a no-op. */
    private fun key(body: RunBody) = body.track.points.firstOrNull()?.t

    fun add(body: RunBody) {
        val k = key(body) ?: return
        val items = read()
        items.removeAll { key(it) == k }
        items.add(body)
        // A runaway queue would grow without bound on a device that never reconnects.
        while (items.size > MAX_QUEUED) items.removeAt(0)
        write(items)
    }

    fun remove(body: RunBody) {
        val k = key(body) ?: return
        write(read().filterNot { key(it) == k })
    }

    fun all(): List<RunBody> = read()

    fun count(): Int = read().size

    companion object {
        private const val MAX_QUEUED = 20

        fun of(context: Context) = PendingRunStore(File(context.filesDir, "data"))
    }
}
