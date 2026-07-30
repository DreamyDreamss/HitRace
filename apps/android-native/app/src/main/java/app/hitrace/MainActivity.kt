package app.hitrace

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import app.hitrace.ui.MainScaffold
import app.hitrace.ui.screens.LoginScreen
import app.hitrace.ui.theme.Rb
import app.hitrace.ui.theme.HitRaceTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { HitRaceTheme { App() } }
    }
}

@Composable
fun App(vm: AppViewModel = viewModel()) {
    val state by vm.auth.collectAsState()
    when (val s = state) {
        is AuthState.Loading -> Box(
            Modifier.fillMaxSize().background(Rb.Bg),
            contentAlignment = Alignment.Center,
        ) { CircularProgressIndicator(color = Rb.Gold) }
        is AuthState.LoggedOut -> LoginScreen(vm)
        is AuthState.LoggedIn -> MainScaffold(vm, s.me)
    }
}
