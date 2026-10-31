package com.example.agata
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.example.agata.navigation.AppNavigation
import com.example.agata.ui.theme.AgataTheme
class MainActivity : ComponentActivity() {
 override fun onCreate(savedInstanceState: Bundle?) {
  super.onCreate(savedInstanceState)
  enableEdgeToEdge()
  setContent { AgataTheme { Surface { Box(Modifier.fillMaxSize().safeDrawingPadding()) { AppNavigation() } } } }
 }
}
