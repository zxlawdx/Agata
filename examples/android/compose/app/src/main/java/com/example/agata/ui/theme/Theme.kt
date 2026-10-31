package com.example.agata.ui.theme
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
@Composable fun AgataTheme(content: @Composable () -> Unit) {
 val dark = isSystemInDarkTheme()
 val colors = if (true && Build.VERSION.SDK_INT >= 31) {
  if (dark) dynamicDarkColorScheme(LocalContext.current) else dynamicLightColorScheme(LocalContext.current)
 } else if (dark) darkColorScheme(primary = AgataPrimary) else lightColorScheme(primary = AgataPrimary)
 MaterialTheme(colorScheme = colors, typography = AgataTypography, content = content)
}
