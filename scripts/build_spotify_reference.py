"""Prepare an independent Android reference using unchanged supplied Kotlin files.
No Gradle execution/download. Building/installing the project is an explicit manual step.
"""
from pathlib import Path
import argparse,sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from apps.android_designer.domain.model import new_document
from apps.android_designer.exporters.project import generate

HOME='s_c311e2496dd94522a1e5322a30bbb754'
LOGIN='s_0bc68d799c0948d7b79c32de362ebcb5'
DASHBOARD='s_ca504b5fa758496588365d681e68ea80'

def prepare(target):
    target=Path(target)
    if target.exists() and any(target.iterdir()):raise ValueError('Escolha pasta nova/vazia; nada será sobrescrito.')
    document=new_document();document['app_name']='Agata Spotify native reference'
    files=generate(document)
    files={p:v for p,v in files.items() if not p.startswith('app/src/main/java/') and p not in {'agata-model.json','agata-export-diagnostics.json'}}
    for source in (Path(__file__).resolve().parents[1]/'examples/spotify_import').glob('*.kt'):files['app/src/main/java/com/example/agata/ui/screens/'+source.name]=source.read_bytes()
    files['app/src/main/java/com/example/agata/MainActivity.kt']='''package com.example.agata
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.*
import androidx.compose.material3.*
import com.example.agata.ui.screens.*
class MainActivity : ComponentActivity() {
 override fun onCreate(savedInstanceState: Bundle?) {
  super.onCreate(savedInstanceState)
  val initial = intent.getStringExtra("screen") ?: "'''+HOME+'''"
  setContent {
   // Explicit harness context: the supplied ZIP has no Activity/Theme/Gradle.
   MaterialTheme(colorScheme = darkColorScheme(primary = AgataDark.accent, background = AgataDark.background, surface = AgataDark.surface, onSurface = AgataDark.text)) {
    val history = remember { mutableStateListOf(initial) }
    val onAction: (String, String) -> Unit = { action, destination ->
     if (action == "back") { if (history.size > 1) history.removeAt(history.lastIndex) }
     else if (action == "navigate") history.add(destination)
    }
    when(history.last()) {
     "'''+LOGIN+'''" -> Screen_s_0bc68d799c0948d7b79c32de362ebcb5(onAction)
     "'''+DASHBOARD+'''" -> Screen_s_ca504b5fa758496588365d681e68ea80(onAction)
     else -> Screen_s_c311e2496dd94522a1e5322a30bbb754(onAction)
    }
   }
  }
 }
}
'''
    target.mkdir(parents=True,exist_ok=True)
    for name,content in files.items():
        path=target/name;path.parent.mkdir(parents=True,exist_ok=True)
        path.write_bytes(content if isinstance(content,bytes) else content.encode())
    (target/'gradlew').chmod(0o755)
    return target

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('output');args=parser.parse_args();print(prepare(args.output))
