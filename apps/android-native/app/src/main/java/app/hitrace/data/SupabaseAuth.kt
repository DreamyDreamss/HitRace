package app.hitrace.data

import app.hitrace.BuildConfig
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Query

/**
 * Supabase Auth (GoTrue) over plain REST — no SDK needed for what we use.
 *
 * The app signs in **anonymously** with the runner's name in user metadata; a DB trigger
 * creates the matching game profile. Linking a real provider (Google) later keeps the
 * same auth user, so game state survives the upgrade.
 */
@Serializable
data class AnonSignUpBody(val data: Map<String, String> = emptyMap())

@Serializable
data class RefreshBody(@SerialName("refresh_token") val refreshToken: String)

@Serializable
data class SupabaseUser(val id: String, val email: String? = null, @SerialName("user_metadata") val meta: JsonObject? = null)

@Serializable
data class SupabaseSession(
    @SerialName("access_token") val accessToken: String = "",
    @SerialName("refresh_token") val refreshToken: String = "",
    @SerialName("expires_in") val expiresIn: Long = 3600,
    val user: SupabaseUser? = null,
)

interface SupabaseAuthApi {
    /** Anonymous sign-in: GoTrue's /signup with no credentials, metadata only. */
    @POST("auth/v1/signup")
    suspend fun signUpAnonymous(@Body body: AnonSignUpBody): SupabaseSession

    @POST("auth/v1/token")
    suspend fun refresh(
        @Query("grant_type") grantType: String = "refresh_token",
        @Body body: RefreshBody,
    ): SupabaseSession
}

object SupabaseAuth {
    val enabled: Boolean get() = BuildConfig.SUPABASE_URL.isNotBlank() && BuildConfig.SUPABASE_ANON_KEY.isNotBlank()

    private val client = OkHttpClient.Builder()
        .addInterceptor { chain ->
            // GoTrue needs the project's anon key on every call, signed-in or not.
            val req = chain.request().newBuilder()
                .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
                .header("Authorization", "Bearer " + (Auth.token ?: BuildConfig.SUPABASE_ANON_KEY))
                .build()
            chain.proceed(req)
        }
        // Sign-in blocks the whole app behind a spinner; it must be able to give up.
        .connectTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
        .writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
        .callTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    val api: SupabaseAuthApi by lazy {
        Retrofit.Builder()
            .baseUrl(BuildConfig.SUPABASE_URL.trimEnd('/') + "/")
            .client(client)
            .addConverterFactory(ApiClient.json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(SupabaseAuthApi::class.java)
    }
}
