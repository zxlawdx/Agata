package com.example.agata.ui.screens
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import com.example.agata.R

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Screen_s_screen_0(onAction: (String, String) -> Unit) {
var v_n_component_8 by rememberSaveable { mutableStateOf("") }
Column(modifier = Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp), horizontalAlignment = Alignment.Start) {
TopAppBar(modifier = Modifier.fillMaxWidth(), colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF96E6EC)), title = { Column { Text(text = stringResource(R.string.n_component_4_text), color = Color(0xFF242424), fontSize = 16.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Start, modifier = Modifier) } }, navigationIcon = { Icon(painterResource(R.drawable.agata_menu), contentDescription = stringResource(R.string.n_component_3_description), tint = Color(0xFF242424), modifier = Modifier.size(24.dp)) }, actions = {  })
Card(modifier = Modifier.fillMaxWidth().padding(12.dp), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF9EF)), elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)) { Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
Text(text = stringResource(R.string.n_component_6_text), color = Color(0xFF242424), fontSize = 20.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Start, modifier = Modifier)
Text(text = stringResource(R.string.n_component_7_text), color = Color(0xFF242424), fontSize = 16.sp, fontWeight = FontWeight.Normal, textAlign = TextAlign.Start, modifier = Modifier)
} }
OutlinedTextField(value = v_n_component_8, onValueChange = { v_n_component_8 = it }, enabled = true, placeholder = { Text(stringResource(R.string.n_component_8_placeholder)) }, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), label = { Text(stringResource(R.string.n_component_8_label)) }, isError = false, supportingText = { Text(stringResource(R.string.n_component_8_helper)) }, leadingIcon = {  }, trailingIcon = {  })
Button(onClick = { onAction("navigate", "s_screen_1") }, modifier = Modifier.fillMaxWidth(), enabled = true, shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF53AFF2))) {
Icon(painterResource(R.drawable.agata_plus), contentDescription = stringResource(R.string.n_component_12_description), tint = Color(0xFF242424), modifier = Modifier.size(24.dp))
Text(text = stringResource(R.string.n_component_13_text), color = Color(0xFF242424), fontSize = 16.sp, fontWeight = FontWeight.Normal, textAlign = TextAlign.Start, modifier = Modifier)
}
NavigationBar(modifier = Modifier.fillMaxWidth(), containerColor = Color(0xFF96E6EC)) {
NavigationBarItem(selected = false, enabled = true, onClick = { onAction("", "") }, label = { Text(text = stringResource(R.string.n_component_17_text), color = Color(0xFF242424), fontSize = 16.sp, fontWeight = FontWeight.Normal, textAlign = TextAlign.Start, modifier = Modifier) }, icon = { Icon(painterResource(R.drawable.agata_home), contentDescription = stringResource(R.string.n_component_16_description), tint = Color(0xFF242424), modifier = Modifier.size(24.dp)) })
NavigationBarItem(selected = false, enabled = true, onClick = { onAction("navigate", "s_screen_1") }, label = { Text(text = stringResource(R.string.n_component_20_text), color = Color(0xFF242424), fontSize = 16.sp, fontWeight = FontWeight.Normal, textAlign = TextAlign.Start, modifier = Modifier) }, icon = { Icon(painterResource(R.drawable.agata_home), contentDescription = stringResource(R.string.n_component_19_description), tint = Color(0xFF242424), modifier = Modifier.size(24.dp)) })
}
}
}
