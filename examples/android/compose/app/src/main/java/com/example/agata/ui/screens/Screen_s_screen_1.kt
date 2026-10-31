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
fun Screen_s_screen_1(onAction: (String, String) -> Unit) {

Column(modifier = Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp), horizontalAlignment = Alignment.Start) {
Text(text = stringResource(R.string.n_component_22_text), color = Color(0xFF242424), fontSize = 24.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Start, modifier = Modifier)
Button(onClick = { onAction("back", "") }, modifier = Modifier.fillMaxWidth(), enabled = true, shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF53AFF2))) {
Icon(painterResource(R.drawable.agata_plus), contentDescription = stringResource(R.string.n_component_24_description), tint = Color(0xFF242424), modifier = Modifier.size(24.dp))
Text(text = stringResource(R.string.n_component_25_text), color = Color(0xFF242424), fontSize = 16.sp, fontWeight = FontWeight.Normal, textAlign = TextAlign.Start, modifier = Modifier)
}
}
}
