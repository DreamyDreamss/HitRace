plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "app.hitrace"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.hitrace"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        vectorDrawables { useSupportLibrary = true }
    }

    // Supabase: set these (gradle.properties or -P flags) and the app switches from the
    // local Fastify dev server to Supabase Auth + the `game` Edge Function.
    //   SUPABASE_URL=https://<ref>.supabase.co
    //   SUPABASE_ANON_KEY=<anon key>
    val supabaseUrl = (project.findProperty("SUPABASE_URL") ?: "").toString().trimEnd('/')
    val supabaseAnonKey = (project.findProperty("SUPABASE_ANON_KEY") ?: "").toString()
    val defaultApiBase = if (supabaseUrl.isNotEmpty()) "$supabaseUrl/functions/v1/game" else "http://10.0.2.2:8787"

    buildTypes {
        debug {
            // Falls back to the emulator → host bridge when no Supabase project is configured.
            buildConfigField("String", "API_BASE", "\"${project.findProperty("API_BASE") ?: defaultApiBase}\"")
            buildConfigField("String", "SUPABASE_URL", "\"$supabaseUrl\"")
            buildConfigField("String", "SUPABASE_ANON_KEY", "\"$supabaseAnonKey\"")
            isMinifyEnabled = false
        }
        release {
            buildConfigField("String", "API_BASE", "\"${project.findProperty("API_BASE") ?: defaultApiBase}\"")
            buildConfigField("String", "SUPABASE_URL", "\"$supabaseUrl\"")
            buildConfigField("String", "SUPABASE_ANON_KEY", "\"$supabaseAnonKey\"")
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.09.02")
    implementation(composeBom)

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.6")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.6")
    implementation("androidx.activity:activity-compose:1.9.2")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.navigation:navigation-compose:2.8.1")

    // Networking → existing Fastify API
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-kotlinx-serialization:2.11.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // Persisted auth token
    implementation("androidx.datastore:datastore-preferences:1.1.1")

    // Native GPS
    implementation("com.google.android.gms:play-services-location:21.3.0")

    debugImplementation("androidx.compose.ui:ui-tooling")

    // JVM unit tests (balance mirror parity with packages/game-core)
    testImplementation("junit:junit:4.13.2")
}
