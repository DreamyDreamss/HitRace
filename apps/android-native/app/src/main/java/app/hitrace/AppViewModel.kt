package app.hitrace

import android.app.Application
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.hitrace.data.AnonSignUpBody
import app.hitrace.data.ApiClient
import app.hitrace.data.Auth
import app.hitrace.data.LoginBody
import app.hitrace.data.MeResp
import app.hitrace.data.PendingRunStore
import app.hitrace.data.RankingRow
import app.hitrace.data.RunUploader
import app.hitrace.data.RefreshBody
import app.hitrace.data.SupabaseAuth
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import retrofit2.HttpException

private val android.content.Context.dataStore by preferencesDataStore(name = "hitrace")
private val TOKEN = stringPreferencesKey("token")
private val REFRESH = stringPreferencesKey("refresh_token")

sealed interface AuthState {
    data object Loading : AuthState
    data object LoggedOut : AuthState
    data class LoggedIn(val me: MeResp) : AuthState
}

class AppViewModel(app: Application) : AndroidViewModel(app) {
    private val ds = getApplication<Application>().dataStore

    private val _auth = MutableStateFlow<AuthState>(AuthState.Loading)
    val auth: StateFlow<AuthState> = _auth

    private val _ranking = MutableStateFlow<List<RankingRow>>(emptyList())
    val ranking: StateFlow<List<RankingRow>> = _ranking

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    /** Runs finished offline and still waiting to reach the server. */
    private val _pendingRuns = MutableStateFlow(0)
    val pendingRuns: StateFlow<Int> = _pendingRuns

    init { bootstrap() }

    private fun bootstrap() = viewModelScope.launch {
        val prefs = runCatching { ds.data.first() }.getOrNull()
        val saved = prefs?.get(TOKEN)
        if (saved.isNullOrBlank()) { _auth.value = AuthState.LoggedOut; return@launch }
        Auth.token = saved
        runCatching { ApiClient.api.me() }
            .onSuccess { _auth.value = AuthState.LoggedIn(it); loadRanking(); flushPendingRuns() }
            .onFailure {
                // A Supabase access token only lives an hour — try the refresh token before
                // dumping the player back to the sign-in screen.
                val refreshed = refreshSession(prefs[REFRESH])
                if (refreshed) {
                    runCatching { ApiClient.api.me() }
                        .onSuccess { me -> _auth.value = AuthState.LoggedIn(me); loadRanking(); flushPendingRuns() }
                        .onFailure { _auth.value = AuthState.LoggedOut }
                } else {
                    _auth.value = AuthState.LoggedOut
                }
            }
    }

    private suspend fun refreshSession(refreshToken: String?): Boolean {
        if (!SupabaseAuth.enabled || refreshToken.isNullOrBlank()) return false
        return runCatching {
            val session = SupabaseAuth.api.refresh(body = RefreshBody(refreshToken))
            Auth.token = session.accessToken
            ds.edit {
                it[TOKEN] = session.accessToken
                it[REFRESH] = session.refreshToken
            }
            true
        }.getOrDefault(false)
    }

    fun login(handle: String = "demo") = viewModelScope.launch {
        _error.value = null
        runCatching {
            if (SupabaseAuth.enabled) {
                // Supabase: anonymous sign-in; the runner name rides along as metadata and a
                // DB trigger creates the game profile.
                val session = SupabaseAuth.api.signUpAnonymous(AnonSignUpBody(mapOf("handle" to handle)))
                Auth.token = session.accessToken
                ds.edit {
                    it[TOKEN] = session.accessToken
                    it[REFRESH] = session.refreshToken
                }
            } else {
                val res = ApiClient.api.login(LoginBody(handle))
                Auth.token = res.token
                ds.edit { it[TOKEN] = res.token }
            }
            ApiClient.api.me()
        }.onSuccess { _auth.value = AuthState.LoggedIn(it); loadRanking(); flushPendingRuns() }
            .onFailure { _error.value = loginErrorMessage(it) }
    }

    fun refresh() = viewModelScope.launch {
        runCatching { ApiClient.api.me() }.onSuccess { _auth.value = AuthState.LoggedIn(it) }
    }

    /**
     * Push anything the queue is holding. Called whenever we have just proven we can reach the
     * server, so a run stranded by a dead signal goes up without the runner chasing it.
     */
    fun flushPendingRuns() = viewModelScope.launch {
        val result = RunUploader.flush(getApplication())
        _pendingRuns.value = result.remaining
        if (result.uploaded > 0) {
            // The wallet and history moved, so whatever is on screen is now stale.
            runCatching { ApiClient.api.me() }.onSuccess { _auth.value = AuthState.LoggedIn(it) }
        }
    }

    fun notePendingRuns() {
        _pendingRuns.value = PendingRunStore.of(getApplication()).count()
    }

    private fun loadRanking() = viewModelScope.launch {
        runCatching { ApiClient.api.ranking() }.onSuccess { _ranking.value = it }
    }

    fun logout() = viewModelScope.launch {
        Auth.token = null
        ds.edit { it.remove(TOKEN); it.remove(REFRESH) }
        _auth.value = AuthState.LoggedOut
    }

    /** Separate "server said no" from "couldn't reach the server" — they need different fixes. */
    private fun loginErrorMessage(e: Throwable): String = when {
        e is HttpException && e.code() == 404 -> "그 이름의 러너가 없습니다. 이름을 확인해 주세요."
        e is HttpException -> "로그인에 실패했습니다 (${e.code()})."
        else -> "연결 실패 — API 서버(${describeBase()})가 켜져 있는지 확인하세요."
    }

    private fun describeBase() = BuildConfig.API_BASE
}
