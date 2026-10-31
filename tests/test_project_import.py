"""Real disk imports, AST mapping, preservation and manager integration."""
import io,json,tempfile,unittest,zipfile,base64
from pathlib import Path
from apps.workspace.repositories.json_repository import JsonProjectRepository
from apps.workspace.services.project_import.coordinator import ImportCoordinator
from apps.workspace.services.project_import.scanner import snapshot
from apps.workspace.services.project_import.export import imported_export
from apps.workspace.services.manager import ProjectManager
from apps.android_designer.domain.model import new_document,new_screen,walk
from apps.android_designer.exporters.project import generate

class ProjectImportTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name);self.repo=JsonProjectRepository(self.root/'projects');self.importer=ImportCoordinator(self.repo)
 def archive(self,files):
  p=self.root/'input.zip'
  with zipfile.ZipFile(p,'w') as z:
   for name,data in files.items():z.writestr(name,data)
  return p
 def test_native_three_screens_ids_events_and_sources_survive(self):
  from apps.android_designer.domain.tutorial_project import tutorial_document
  doc=tutorial_document();doc['screens']=doc['screens'][:3];doc['screens'][0]['name']='Home'
  ids={s['id'] for s in doc['screens']}
  for screen in doc['screens']:
   for node in walk(screen['root']):
    if node['events'].get('onClick',{}).get('action')=='navigate' and node['events']['onClick']['target'] not in ids:node['events']={}
  files=generate(doc);files['notes.kt']='// unknown source must survive\n'
  original=self.archive(files);before=original.read_bytes();preview=self.importer.analyze(original)
  self.assertEqual(preview['screen_count'],3);self.assertTrue(preview['warnings']);self.assertEqual(self.repo.list(),[])
  p=self.importer.confirm(preview['token'],'Imported');loaded=self.repo.get(p['id']);actual=loaded['interface_document']
  self.assertEqual(actual['screens'],doc['screens']);self.assertEqual(actual['start_screen'],doc['start_screen']);self.assertEqual(original.read_bytes(),before)
  exported=imported_export(self.repo,p['id'],'compose',root=self.root/'out')
  with zipfile.ZipFile(exported['path']) as z:self.assertEqual(z.read('AgataExport/notes.kt'),files['notes.kt'].encode());self.assertEqual(z.read('AgataExport/agata-original/notes.kt'),files['notes.kt'].encode())
 def test_security_no_project_created_for_unsafe_zip(self):
  for path in ['../escape.kt','/absolute.kt','C:/escape.kt','a/../../escape.kt']:
   with self.subTest(path=path):
    with self.assertRaises(ValueError):self.importer.analyze(self.archive({path:'x'}))
  self.assertEqual(self.repo.list(),[]);self.assertFalse((self.root/'escape.kt').exists())
 def test_symlink_and_corrupt_zip(self):
  path=self.root/'link.zip'
  with zipfile.ZipFile(path,'w') as z:
   item=zipfile.ZipInfo('link.kt');item.external_attr=0o120777<<16;z.writestr(item,'/tmp/x')
  with self.assertRaises(ValueError):snapshot(path)
  path.write_bytes(b'not a zip')
  with self.assertRaises(ValueError):snapshot(path)
 def test_ast_nested_literals_and_dynamic_code_diagnostics(self):
  text='''package com.example.imported
import androidx.compose.runtime.Composable
@Composable fun Home() { Column { Text("Hello (world)"); Button(onClick = { nav.navigate("Login") }) { Text("Next") }; CustomWidget() } }
@Composable fun Login() { Box { Text(text = "Login") } }
'''
  preview=self.importer.analyze(files={'Home.kt':text.encode()});self.assertEqual(preview['screen_count'],2);self.assertGreater(preview['classification']['code_only'],0)
  p=self.importer.confirm(preview['token']);doc=self.repo.get(p['id'])['interface_document'];nodes=[n for n in walk(doc['screens'][0]['root'])];self.assertIn('Hello (world)',[n['props'].get('text') for n in nodes]);button=next(n for n in nodes if n['type']=='Button');self.assertEqual(button['events']['onClick']['target'],doc['screens'][1]['id'])
 def test_empty_android_and_folder_require_no_fake_screens(self):
  preview=self.importer.analyze(files={'app/build.gradle.kts':b'plugins {}','app/src/main/AndroidManifest.xml':b'<manifest><application/></manifest>'});self.assertTrue(preview['empty']);p=self.importer.confirm(preview['token']);self.assertEqual(self.repo.get(p['id'])['interface_document']['screens'],[])
  folder=self.root/'empty';folder.mkdir();preview=self.importer.analyze(folder)
  with self.assertRaises(ValueError):self.importer.confirm(preview['token'])
  self.assertEqual(list(folder.iterdir()),[]);self.importer.cancel(preview['token'])
 def test_edit_snapshot_conflict_reanalysis_and_manager(self):
  source=b'@Composable fun Home() { Column { Text("Before") } }'
  preview=self.importer.analyze(files={'Home.kt':source});p=self.importer.confirm(preview['token']);pid=p['id'];file=self.importer.source(pid,'Home.kt');self.importer.save_source(pid,'Home.kt',source.decode().replace('Before','After'),file['sha256'])
  with self.assertRaises(ValueError):self.importer.save_source(pid,'Home.kt','stale',file['sha256'])
  self.assertEqual((self.repo._read_path(pid).parent/'original-source/Home.kt').read_bytes(),source)
  analysis=self.importer.reanalyze(pid);self.assertIn('After',json.dumps(analysis['document']));self.importer.cancel(analysis['token'])
  manager=ProjectManager(self.repo);manager.action(pid,'rename','Renamed');copy=manager.action(pid,'duplicate');self.assertNotEqual(copy['id'],pid);self.assertIn('After',self.importer.source(copy['id'],'Home.kt')['content']);manager.action(pid,'remove_recent');self.assertNotIn(pid,[p['id'] for p in manager.list()]);self.assertEqual(self.repo.get(pid)['name'],'Renamed');manager.action(pid,'touch');self.assertIn(pid,[p['id'] for p in manager.list()])

if __name__=='__main__':unittest.main()

class AdditionalImportTests(unittest.TestCase):
 setUp=ProjectImportTests.setUp
 archive=ProjectImportTests.archive
 def test_static_constraint_refs_guideline_and_bias(self):
  code=b'@Composable fun Home(){ ConstraintLayout { val a = createRef(); val g = createGuidelineFromTop(0.3f); Text("Hi", Modifier.constrainAs(a) { start.linkTo(parent.start, margin = 16.dp); top.linkTo(g); width = Dimension.fillToConstraints; horizontalBias = 0.3f }) } }'
  preview=self.importer.analyze(files={'Home.kt':code});p=self.importer.confirm(preview['token']);root=self.repo.get(p['id'])['interface_document']['screens'][0]['root'];label=next(n for n in root['children'] if n['type']=='TextLabel');self.assertEqual(label['layout']['constraints']['start']['margin'],16);self.assertEqual(label['layout']['width'],'fill');self.assertEqual(label['layout']['horizontalBias'],.3);self.assertEqual(next(n for n in root['children'] if n['type']=='Guideline')['props']['percent'],.3)
 def test_multi_kotlin_upload_retains_names(self):
  preview=self.importer.upload_sources([{'name':name,'data':base64.b64encode(('@Composable fun '+function+'(){ Column { Text("Hello") } }').encode()).decode()} for name,function in [('Home.kt','Home'),('Login.kt','Login')]])
  self.assertEqual(preview['screen_count'],2);self.assertEqual(preview['files'],['Home.kt','Login.kt']);self.importer.cancel(preview['token'])
 def test_external_empty_preserves_configuration_and_launcher_by_default(self):
  files={'app/build.gradle.kts':b'plugins {} // original plugin config','settings.gradle.kts':b'// original settings','app/src/main/AndroidManifest.xml':b'<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application><activity android:name=".MainActivity"><intent-filter><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity></application></manifest>','app/src/main/java/MainActivity.kt':b'class MainActivity { fun businessLogic() = 42 }'}
  preview=self.importer.analyze(files=files);p=self.importer.confirm(preview['token']);p=self.repo.get(p['id']);p['interface_document']=new_document();self.repo.save(p)
  result=imported_export(self.repo,p['id'],'xml',root=self.root/'exports')
  with zipfile.ZipFile(result['path']) as z:
   for name in ['app/build.gradle.kts','settings.gradle.kts','app/src/main/java/MainActivity.kt']:self.assertEqual(z.read('AgataExport/'+name),files[name])
   self.assertIn(b'AgataImportedActivity',z.read('AgataExport/app/src/main/AndroidManifest.xml'))
