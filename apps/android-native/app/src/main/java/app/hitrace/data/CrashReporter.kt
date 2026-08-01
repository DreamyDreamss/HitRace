package app.hitrace.data

import android.content.Context
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter

/**
 * Records the last uncaught exception to disk, then hands off to the default handler so the
 * system still shows its dialog and restarts normally — swallowing the crash would hide it from
 * the platform without making the app any healthier.
 *
 * There is no crash reporting service wired up yet, so without this a report of "앱이 계속
 * 중단됨" leaves nothing to look at.
 */
object CrashReporter {
    private const val FILE = "last_crash.txt"

    fun install(app: Context) {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, ex ->
            runCatching {
                val dir = File(app.filesDir, "crash").apply { mkdirs() }
                val trace = StringWriter().also { ex.printStackTrace(PrintWriter(it)) }
                File(dir, FILE).writeText(
                    buildString {
                        appendLine("time=${System.currentTimeMillis()}")
                        appendLine("thread=${thread.name}")
                        appendLine("device=${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}")
                        appendLine("sdk=${android.os.Build.VERSION.SDK_INT}")
                        appendLine()
                        append(trace)
                    },
                )
            }
            previous?.uncaughtException(thread, ex)
        }
    }

    fun lastCrash(app: Context): String? =
        File(File(app.filesDir, "crash"), FILE).takeIf { it.exists() }?.readText()

    fun clear(app: Context) {
        runCatching { File(File(app.filesDir, "crash"), FILE).delete() }
    }
}
