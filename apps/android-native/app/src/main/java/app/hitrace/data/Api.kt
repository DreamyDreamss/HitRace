package app.hitrace.data

import app.hitrace.BuildConfig
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Interceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface HitRaceApi {
    @POST("auth/dev/login")
    suspend fun login(@Body body: LoginBody): LoginResp

    @GET("me")
    suspend fun me(): MeResp

    @GET("swords")
    suspend fun swords(): List<Sword>

    @GET("swords/{id}")
    suspend fun sword(@Path("id") id: String): Sword

    @POST("swords/{id}/equip")
    suspend fun equip(@Path("id") id: String): User

    @POST("runs")
    suspend fun submitRun(@Body body: RunBody): ForgeResult

    @POST("runs/manual")
    suspend fun manualRun(@Body body: ManualRunBody): ForgeResult

    @GET("pvp/ranking")
    suspend fun ranking(): List<RankingRow>

    @GET("profile")
    suspend fun profile(): ProfileResp

    @POST("swords/dismantle")
    suspend fun dismantle(@Body body: DismantleBody): DismantleResp

    @POST("swords/{id}/upgrade")
    suspend fun upgrade(@Path("id") id: String, @Body body: UpgradeBody): UpgradeResp

    @POST("swords/{id}/engrave")
    suspend fun engrave(@Path("id") id: String, @Body body: EngraveBody): EngraveResp

    @POST("gacha/pull")
    suspend fun gacha(@Body body: GachaBody): GachaResp

    @GET("pvp/match")
    suspend fun match(@Query("waitSec") waitSec: Int): MatchResp

    @POST("pvp/resolve")
    suspend fun resolve(@Body body: ResolveBody): ResolveResp

    @GET("season")
    suspend fun season(): SeasonResp

    @GET("runs")
    suspend fun runs(@Query("limit") limit: Int = 50): List<RunSummary>

    @GET("runs/{id}")
    suspend fun runDetail(@Path("id") id: String): RunDetailResp

    @GET("stats/running")
    suspend fun runningStats(): RunningStats

    @GET("codex")
    suspend fun codex(): CodexResp

    @GET("courses/{hash}/leaderboard")
    suspend fun courseBoard(@Path("hash") hash: String): List<CourseScoreRow>

    @POST("swords/{id}/reforge")
    suspend fun reforge(@Path("id") id: String, @Body body: ReforgeBody): Sword

    @POST("forge/fusion")
    suspend fun fusion(@Body body: FusionBody): FusionResp
}

/** Holds the bearer token in memory + injects it; token is persisted via DataStore by the repo. */
object Auth {
    @Volatile var token: String? = null
}

object ApiClient {
    // encodeDefaults so a body like the workshop transform round-trips every field
    // (without it, `rotate = 0` etc. are dropped and the server stores `{}`).
    val json = Json { ignoreUnknownKeys = true; explicitNulls = false; encodeDefaults = true }

    private val authInterceptor = Interceptor { chain ->
        val req = chain.request().newBuilder().apply {
            Auth.token?.let { header("Authorization", "Bearer $it") }
            // Supabase's gateway rejects calls without the project key, even with a JWT.
            if (SupabaseAuth.enabled) header("apikey", BuildConfig.SUPABASE_ANON_KEY)
        }.build()
        chain.proceed(req)
    }

    private val client = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .build()

    private fun base(): String {
        val b = BuildConfig.API_BASE.trimEnd('/')
        return "$b/"
    }

    val api: HitRaceApi = Retrofit.Builder()
        .baseUrl(base())
        .client(client)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(HitRaceApi::class.java)
}
