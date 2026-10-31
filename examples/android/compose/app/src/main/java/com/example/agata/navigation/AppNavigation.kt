package com.example.agata.navigation
import androidx.compose.runtime.Composable
import androidx.navigation.compose.*
import com.example.agata.ui.screens.*
@Composable fun AppNavigation() {
 val navController = rememberNavController()
 NavHost(navController, startDestination = "s_screen_0") {
 composable("s_screen_0") { Screen_s_screen_0(onAction = { action, target -> if (action == "back") navController.popBackStack() else if (action == "navigate") navController.navigate(target) }) }
composable("s_screen_1") { Screen_s_screen_1(onAction = { action, target -> if (action == "back") navController.popBackStack() else if (action == "navigate") navController.navigate(target) }) }
 }
}
