package com.example.agata.ui.screens

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// Tokens compartilhados pelas três telas. Inspirado na linguagem visual de apps musicais.
internal object AgataDark {
    val background = Color(0xFF101114)
    val surface = Color(0xFF191B1F)
    val surfaceRaised = Color(0xFF24272C)
    val accent = Color(0xFF1ED760)
    val text = Color(0xFFF5F7F7)
    val secondary = Color(0xFFB0B5B9)
}

internal const val AGATA_HOME = "s_c311e2496dd94522a1e5322a30bbb754"
internal const val AGATA_LOGIN = "s_0bc68d799c0948d7b79c32de362ebcb5"
internal const val AGATA_DASHBOARD = "s_ca504b5fa758496588365d681e68ea80"

@Composable
internal fun AgataHero(title: String, subtitle: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.background(
            Brush.linearGradient(listOf(Color(0xFF175E3C), Color(0xFF252D2B), AgataDark.surface)),
            RoundedCornerShape(22.dp)
        ).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("AGATA  /  DEMO", color = AgataDark.accent, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        Text(title, color = AgataDark.text, fontSize = 30.sp, lineHeight = 34.sp, fontWeight = FontWeight.Bold)
        Text(subtitle, color = AgataDark.secondary, fontSize = 14.sp, lineHeight = 20.sp)
    }
}

@Composable
internal fun AgataPanel(title: String, body: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.background(AgataDark.surface, RoundedCornerShape(18.dp)).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(title, color = AgataDark.text, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
        Text(body, color = AgataDark.secondary, fontSize = 14.sp, lineHeight = 20.sp)
    }
}

@Composable
internal fun AgataAction(text: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Button(
        onClick = onClick, modifier = modifier.heightIn(min = 52.dp),
        shape = RoundedCornerShape(50),
        colors = ButtonDefaults.buttonColors(containerColor = AgataDark.accent, contentColor = Color(0xFF101410))
    ) { Text(text, fontWeight = FontWeight.Bold, fontSize = 15.sp) }
}

@Composable
fun Screen_s_c311e2496dd94522a1e5322a30bbb754(onAction: (String, String) -> Unit) {
    BoxWithConstraints(Modifier.fillMaxSize().background(AgataDark.background)) {
        val wide = maxWidth >= 700.dp
        Row(Modifier.fillMaxSize()) {
            if (wide) {
                Column(
                    Modifier.width(210.dp).fillMaxHeight().background(AgataDark.surface).padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(18.dp)
                ) {
                    Text("● agata", color = AgataDark.accent, fontSize = 25.sp, fontWeight = FontWeight.Black)
                    Text("Início", color = AgataDark.text, fontWeight = FontWeight.Bold)
                    Text("Experiência visual", color = AgataDark.secondary)
                    HorizontalDivider(color = AgataDark.surfaceRaised)
                    Text("01  Tela inicial", color = AgataDark.accent)
                    Text("02  Login", color = AgataDark.secondary, modifier = Modifier.clickable { onAction("navigate", AGATA_LOGIN) })
                    Text("03  Dashboard", color = AgataDark.secondary, modifier = Modifier.clickable { onAction("navigate", AGATA_DASHBOARD) })
                }
            }
            Column(
                Modifier.weight(1f).fillMaxHeight().verticalScroll(rememberScrollState()).padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp)
            ) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Boa experiência 👋", color = AgataDark.text, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    Text("● Demo", color = AgataDark.accent, fontSize = 13.sp)
                }
                AgataHero("Seu próximo projeto começa aqui.", "Uma demonstração de interface moderna criada com Jetpack Compose.", Modifier.fillMaxWidth())
                Text("Explore", color = AgataDark.text, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                if (wide) {
                    Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        AgataPanel("Acesso rápido", "Experimente os componentes de formulário e navegação.", Modifier.weight(1f))
                        AgataPanel("Visão geral", "Uma segunda tela com cards e métricas ilustrativas.", Modifier.weight(1f))
                    }
                } else {
                    AgataPanel("Acesso rápido", "Experimente os componentes de formulário e navegação.", Modifier.fillMaxWidth())
                    AgataPanel("Visão geral", "Uma segunda tela com cards e métricas ilustrativas.", Modifier.fillMaxWidth())
                }
                AgataAction("Abrir login", { onAction("navigate", AGATA_LOGIN) }, Modifier.fillMaxWidth())
                OutlinedButton(
                    onClick = { onAction("navigate", AGATA_DASHBOARD) },
                    modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = AgataDark.text)
                ) { Text("Ver dashboard") }
            }
        }
    }
}
