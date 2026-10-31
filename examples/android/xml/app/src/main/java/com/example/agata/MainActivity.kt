package com.example.agata
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
class MainActivity : AppCompatActivity() {
 private val history = mutableListOf<String>()
 override fun onCreate(savedInstanceState: Bundle?) {
  super.onCreate(savedInstanceState)
  history.addAll(savedInstanceState?.getStringArrayList("routes") ?: arrayListOf("s_screen_0"))
  openScreen(history.last(), false)
 }
 private fun openScreen(route: String, push: Boolean) {
  if (push) history.add(route)
  when(route) { "s_screen_0" -> { setContentView(R.layout.s_screen_0); findViewById<android.view.View>(R.id.n_component_11)?.setOnClickListener { openScreen("s_screen_1", true) }; findViewById<android.view.View>(R.id.n_component_18)?.setOnClickListener { openScreen("s_screen_1", true) } }
"s_screen_1" -> { setContentView(R.layout.s_screen_1); findViewById<android.view.View>(R.id.n_component_23)?.setOnClickListener { goBack() } } }
 }
 private fun goBack() { if (history.size > 1) { history.removeAt(history.lastIndex); openScreen(history.last(), false) } else finish() }
 @Deprecated("Legacy Activity back dispatch") override fun onBackPressed() { goBack() }
 override fun onSaveInstanceState(outState: Bundle) { outState.putStringArrayList("routes", ArrayList(history)); super.onSaveInstanceState(outState) }
}
