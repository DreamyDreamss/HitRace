package app.hitrace.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState

/** Load an async value once (or when [key] changes). Returns null until loaded / on error. */
@Composable
fun <T> rememberLoad(key: Any? = Unit, loader: suspend () -> T): T? {
    val state by produceState<T?>(initialValue = null, key1 = key) {
        value = runCatching { loader() }.getOrNull()
    }
    return state
}
