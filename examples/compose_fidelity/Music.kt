package demo.music
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.navigation.NavHostController
import androidx.navigation.compose.*
import demo.music.ui.theme.SpotifyGreen
import demo.music.ui.theme.BackgroundDark
import demo.music.ui.theme.PanelDark

private val MusicColors = darkColorScheme(primary = SpotifyGreen, background = BackgroundDark, surface = PanelDark, onSurface = Color.White)
private val MusicType = Typography(headlineLarge = androidx.compose.ui.text.TextStyle(fontSize = 28.sp, lineHeight = 34.sp, fontWeight = FontWeight.Bold))

@Composable fun MusicApp(nav: NavHostController) {
    MaterialTheme(colorScheme = MusicColors, typography = MusicType) {
        NavHost(navController = nav, startDestination = "home") {
            composable("home") { Home() }
            composable("login") { Login() }
            composable("dashboard") { Dashboard() }
        }
    }
}
@Composable fun Home() {
    Column(Modifier.fillMaxSize().background(BackgroundDark).padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        AgataHero("Sua música, seu mundo")
        AgataPanel("Minhas músicas")
        AgataAction("Entrar")
    }
}
@Composable fun Login() {
    Column(Modifier.fillMaxSize().background(BackgroundDark).padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("Login", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold)
        OutlinedTextField(value = "", onValueChange = {}, label = { Text("E-mail") })
        AgataAction("Continuar")
    }
}
@Composable fun Dashboard() {
    Column(Modifier.fillMaxSize().background(BackgroundDark).padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("Dashboard", style = MaterialTheme.typography.headlineLarge, color = MaterialTheme.colorScheme.onSurface)
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            if (maxWidth >= 600.dp) { Row { MetricCard("100"); MetricCard("200") } }
            else { Column { MetricCard("100"); MetricCard("200") } }
        }
    }
}
@Composable fun AgataHero(title: String) {
    Text(title, color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
}
@Composable fun AgataPanel(title: String) {
    Card(modifier = Modifier.fillMaxWidth().padding(16.dp), shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = PanelDark)) {
        Text(title, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(20.dp))
    }
}
@Composable fun AgataAction(title: String) {
    Button(colors = ButtonDefaults.buttonColors(containerColor = SpotifyGreen, contentColor = Color.Black), onClick = {}) { Text(title) }
}
@Composable fun MetricCard(value: String) {
    Card(colors = CardDefaults.cardColors(containerColor = PanelDark), shape = RoundedCornerShape(12.dp)) { Text(value, color = Color.White, modifier = Modifier.padding(16.dp)) }
}
