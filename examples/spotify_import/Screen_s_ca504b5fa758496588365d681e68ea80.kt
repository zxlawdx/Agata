package com.example.agata.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun Screen_s_ca504b5fa758496588365d681e68ea80(onAction: (String, String) -> Unit) {
    Column(
        Modifier.fillMaxSize().background(AgataDark.background).verticalScroll(rememberScrollState()).padding(22.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("● agata", color = AgataDark.accent, fontWeight = FontWeight.Black, fontSize = 24.sp)
            TextButton(onClick = { onAction("back", "") }) { Text("← Voltar", color = AgataDark.text) }
        }
        AgataHero("Seu dashboard", "Um painel demonstrativo com informações fictícias e visual imersivo.", Modifier.fillMaxWidth())
        Text("Visão geral", color = AgataDark.text, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            if (maxWidth >= 610.dp) {
                Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    MetricCard("Projetos", "12", Modifier.weight(1f))
                    MetricCard("Telas", "36", Modifier.weight(1f))
                    MetricCard("Componentes", "128", Modifier.weight(1f))
                }
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    MetricCard("Projetos", "12", Modifier.fillMaxWidth())
                    MetricCard("Telas", "36", Modifier.fillMaxWidth())
                    MetricCard("Componentes", "128", Modifier.fillMaxWidth())
                }
            }
        }
        AgataPanel("Sua biblioteca", "Aqui você poderia exibir componentes, layouts favoritos e projetos recentes.", Modifier.fillMaxWidth())
        AgataAction("Voltar ao início", { onAction("navigate", AGATA_HOME) }, Modifier.fillMaxWidth())
    }
}

@Composable
private fun MetricCard(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier.background(AgataDark.surfaceRaised, RoundedCornerShape(18.dp)).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(label, color = AgataDark.secondary, fontSize = 13.sp)
        Text(value, color = AgataDark.accent, fontSize = 36.sp, fontWeight = FontWeight.Bold)
        Text("Dados ilustrativos", color = AgataDark.secondary, fontSize = 11.sp)
    }
}
