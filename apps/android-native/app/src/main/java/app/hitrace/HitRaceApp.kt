package app.hitrace

import android.app.Application
import app.hitrace.data.CrashReporter

/**
 * Process-wide setup. The crash handler goes in here rather than in an Activity so it is armed
 * before anything else runs — including the tracking service, which can be started by the system
 * without any Activity existing.
 */
class HitRaceApp : Application() {
    override fun onCreate() {
        super.onCreate()
        CrashReporter.install(this)
    }
}
