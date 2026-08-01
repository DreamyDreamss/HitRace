package app.hitrace.data

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings

/**
 * Some OEM builds (Samsung's are the ones this keeps happening on) kill a foreground service
 * anyway unless the app is exempt from battery optimisation. When that happens mid-run the
 * recording just stops, and the runner finds out at the end.
 *
 * So the ask repeats every session until the exemption is actually granted — a one-shot prompt
 * that someone dismisses while walking out the door protects nobody.
 */
object BatteryOptimization {

    fun isExempt(context: Context): Boolean = runCatching {
        context.getSystemService(PowerManager::class.java)
            .isIgnoringBatteryOptimizations(context.packageName)
    }.getOrDefault(true) // can't tell → don't nag

    /** Opens the system dialog. Returns false if this device has no such screen. */
    fun request(context: Context): Boolean = runCatching {
        @Suppress("BatteryLife") // the app records location for an hour at a time; this is the case the flag is for
        val intent = Intent(
            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            Uri.parse("package:${context.packageName}"),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        true
    }.getOrDefault(false)
}
