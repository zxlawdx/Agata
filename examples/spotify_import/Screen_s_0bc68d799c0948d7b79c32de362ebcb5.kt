package com.example.agata.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun Screen_s_0bc68d799c0948d7b79c32de362ebcb5(onAction: (String, String) -> Unit) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var showPassword by rememberSaveable { mutableStateOf(false) }
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedTextColor = AgataDark.text, unfocusedTextColor = AgataDark.text,
        focusedBorderColor = AgataDark.accent, unfocusedBorderColor = AgataDark.secondary,
        focusedLabelColor = AgataDark.accent, unfocusedLabelColor = AgataDark.secondary,
        cursorColor = AgataDark.accent,
        focusedPlaceholderColor = AgataDark.secondary, unfocusedPlaceholderColor = AgataDark.secondary
    )
    Box(Modifier.fillMaxSize().background(AgataDark.background), contentAlignment = Alignment.Center) {
        Column(
            Modifier.fillMaxWidth().widthIn(max = 470.dp).verticalScroll(rememberScrollState()).padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            TextButton(onClick = { onAction("back", "") }) { Text("← Voltar", color = AgataDark.secondary) }
            Text("● agata", color = AgataDark.accent, fontSize = 30.sp, fontWeight = FontWeight.Black)
            Text("Entre no seu espaço", color = AgataDark.text, fontSize = 31.sp, lineHeight = 35.sp, fontWeight = FontWeight.Bold)
            Text("Uma tela de login criada para testar o seu editor visual.", color = AgataDark.secondary, fontSize = 14.sp)
            Spacer(Modifier.height(5.dp))
            OutlinedTextField(
                value = email, onValueChange = { email = it },
                label = { Text("E-mail") }, placeholder = { Text("nome@exemplo.com") },
                singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), colors = fieldColors
            )
            OutlinedTextField(
                value = password, onValueChange = { password = it },
                label = { Text("Senha") }, placeholder = { Text("Digite sua senha") }, singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                trailingIcon = { TextButton(onClick = { showPassword = !showPassword }) { Text(if (showPassword) "Ocultar" else "Mostrar", color = AgataDark.accent) } },
                modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), colors = fieldColors
            )
            AgataAction("Entrar na demonstração", { onAction("navigate", AGATA_DASHBOARD) }, Modifier.fillMaxWidth())
            Text("Demonstração visual: o botão não realiza autenticação real.", color = AgataDark.secondary, fontSize = 12.sp)
        }
    }
}
