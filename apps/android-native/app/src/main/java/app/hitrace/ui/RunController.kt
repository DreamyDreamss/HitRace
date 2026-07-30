package app.hitrace.ui

import android.content.Context
import app.hitrace.data.RunStatus
import app.hitrace.data.RunTracker
import app.hitrace.data.TrackDto
import app.hitrace.service.RunTrackingService

/**
 * Thin facade the Running screen drives. All state and GPS work live in
 * [RunTrackingService] / [RunTracker] so a run keeps recording when the app is backgrounded
 * or the screen is off — the screen only sends commands and reads the shared state.
 */
class RunController(private val context: Context) {

    fun start() = RunTrackingService.send(context, RunTrackingService.ACTION_START)

    fun simulate() = RunTrackingService.send(context, RunTrackingService.ACTION_SIMULATE)

    fun pause() = RunTrackingService.send(context, RunTrackingService.ACTION_PAUSE)

    fun resume() = RunTrackingService.send(context, RunTrackingService.ACTION_RESUME)

    /** Stops tracking and returns the finished track for submission. */
    fun finish(): TrackDto {
        RunTracker.setStatus(RunStatus.FINISHED)
        RunTrackingService.send(context, RunTrackingService.ACTION_STOP)
        return RunTracker.track()
    }

    /** Abandon a run in progress (leaving the screen without finishing keeps it running). */
    fun cancel() {
        RunTrackingService.send(context, RunTrackingService.ACTION_STOP)
        RunTracker.clear()
    }
}
