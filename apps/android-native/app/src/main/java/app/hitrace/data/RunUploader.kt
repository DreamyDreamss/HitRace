package app.hitrace.data

import android.content.Context
import android.util.Log
import java.io.IOException

/**
 * Drains the pending-run queue. Called wherever the app has just become able to reach the
 * server — app start, sign-in, opening the home screen — so a run saved during a blackout goes
 * up at the first opportunity without the runner doing anything.
 */
object RunUploader {

    data class Result(val uploaded: Int, val dropped: Int, val remaining: Int)

    suspend fun flush(context: Context): Result {
        val store = PendingRunStore.of(context)
        if (Auth.token == null) return Result(0, 0, store.count())
        val items = store.all()
        if (items.isEmpty()) return Result(0, 0, 0)

        var uploaded = 0
        var dropped = 0
        for (body in items) {
            val outcome = runCatching { ApiClient.api.submitRun(body) }
            if (outcome.isSuccess) {
                store.remove(body)
                uploaded++
                continue
            }
            // A 4xx is an answer: the server looked at this run and said no, so retrying forever
            // would keep a dead run in the queue. Only transport failures deserve another attempt.
            val status = outcome.exceptionOrNull()?.apiFailure()?.status
            val permanent = status != null && status in 400..499 && status != 429
            if (permanent) {
                Log.i(TAG, "dropping queued run: server answered $status")
                store.remove(body)
                dropped++
                continue
            }
            val cause = outcome.exceptionOrNull()
            if (cause !is IOException) Log.w(TAG, "queued run failed: ${cause?.message}")
            break // still offline (or the server is down) — leave the rest for next time
        }
        return Result(uploaded, dropped, store.count())
    }

    private const val TAG = "RunUploader"
}
