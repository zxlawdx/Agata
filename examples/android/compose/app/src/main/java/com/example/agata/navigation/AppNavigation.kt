package com.example.agata.navigation
import androidx.compose.runtime.Composable
import androidx.navigation.compose.*
import com.example.agata.ui.screens.*
@Composable fun AppNavigation() {
 val context = androidx.compose.ui.platform.LocalContext.current
 val navController = rememberNavController()
 NavHost(navController, startDestination = "s_screen_0") {
 composable("s_screen_0") { Screen_s_screen_0(onAction = { action, target -> if (action == "back") navController.popBackStack() else if (action == "navigate" || action == "replace" || action.startsWith("popUpTo:")) navController.navigate(target) { launchSingleTop = true; if (action == "replace") popUpTo(navController.currentDestination?.route ?: target) { inclusive = true }; if (action.startsWith("popUpTo:")) popUpTo(action.substringAfter(":")) } else if (action == "url") context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(target))) else if (action == "custom") android.widget.Toast.makeText(context, "Ação: " + target, android.widget.Toast.LENGTH_SHORT).show() }) }
composable("s_screen_1") { Screen_s_screen_1(onAction = { action, target -> if (action == "back") navController.popBackStack() else if (action == "navigate" || action == "replace" || action.startsWith("popUpTo:")) navController.navigate(target) { launchSingleTop = true; if (action == "replace") popUpTo(navController.currentDestination?.route ?: target) { inclusive = true }; if (action.startsWith("popUpTo:")) popUpTo(action.substringAfter(":")) } else if (action == "url") context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(target))) else if (action == "custom") android.widget.Toast.makeText(context, "Ação: " + target, android.widget.Toast.LENGTH_SHORT).show() }) }
 }
}
