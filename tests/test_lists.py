import unittest
from xml.etree import ElementTree as ET
from apps.android_designer.domain.model import new_document,new_node,validate,walk
from apps.android_designer.exporters.project import generate
from apps.workspace.services.project_import.compose import ComposeParser
from apps.workspace.services.project_import.resources import resolve_resources

class ListsTests(unittest.TestCase):
 def test_seven_editable_lists_and_native_exports(self):
  doc=new_document();types=['ListView','RecyclerView','GridView','LazyColumn','LazyRow','LazyVerticalGrid','LazyStaggeredGrid'];doc['screens'][0]['root']['children']=[new_node(t) for t in types];validate(doc)
  compose=generate(doc);code='\n'.join(v for k,v in compose.items() if k.endswith('.kt'))
  for name in ['LazyColumn(','LazyRow(','LazyVerticalGrid(','LazyVerticalStaggeredGrid(','item(key =']:self.assertIn(name,code)
  import tree_sitter,tree_sitter_kotlin
  parser=tree_sitter.Parser(tree_sitter.Language(tree_sitter_kotlin.language()))
  for backend in ['compose','xml']:
   for path,content in generate(doc,backend).items():
    if path.endswith('.kt'):self.assertFalse(parser.parse(content.encode()).root_node.has_error,path)
  xml=generate(doc,'xml');activity=next(v for k,v in xml.items() if k.endswith('MainActivity.kt'))
  self.assertIn('BaseAdapter()',activity);self.assertIn('RecyclerView.Adapter<AgataItemHolder>',activity);self.assertIn('LinearLayoutManager',activity);self.assertIn('GridLayoutManager',activity);self.assertIn('StaggeredGridLayoutManager',activity);self.assertIn('androidx.recyclerview:recyclerview:',xml['app/build.gradle.kts'])
  layout=ET.fromstring(xml['app/src/main/res/layout/'+doc['screens'][0]['id']+'.xml']);tags=[n.tag for n in layout.iter()];self.assertIn('ListView',tags);self.assertIn('GridView',tags);self.assertIn('androidx.recyclerview.widget.RecyclerView',tags)
  for node in doc['screens'][0]['root']['children']:
   for child in node['children']:self.assertIn('app/src/main/res/layout/agata_item_'+child['id']+'.xml',xml)
 def test_static_lazy_items_import_and_dynamic_diagnostics(self):
  code='@Composable fun Home(){ LazyVerticalGrid(columns = GridCells.Fixed(3)) { item(key="a") { Text("A") }; items(values) { Text(it) } } }'
  parser=ComposeParser({'Home.kt':code},resolve_resources({})[0]);doc=parser.parse();lazy=next(n for n in walk(doc['screens'][0]['root']) if n['type']=='LazyVerticalGrid');self.assertEqual(lazy['layout']['columns'],3);self.assertTrue(lazy['children']);self.assertGreater(parser.counts['code_only'],0)
 def test_horizontal_staggered_recycler_uses_horizontal_api(self):
  doc=new_document();node=new_node('RecyclerView',{'orientation':'horizontal','layoutManager':'staggered'});doc['screens'][0]['root']['children']=[node];files=generate(doc);code='\n'.join(v for k,v in files.items() if k.endswith('.kt'));self.assertIn('LazyHorizontalStaggeredGrid(',code);self.assertIn('horizontalItemSpacing = 8.dp',code);self.assertNotIn('verticalItemSpacing',code)
 def test_bad_recycler_configuration_rejected(self):
  doc=new_document();node=new_node('RecyclerView');node['props']['layoutManager']='arbitrary';doc['screens'][0]['root']['children']=[node]
  with self.assertRaises(ValueError):validate(doc)
 def test_sdk_and_orientation_reach_generated_configuration(self):
  doc=new_document();doc['theme']['darkMode']='dark';self.assertIn('AppCompatDelegate.MODE_NIGHT_YES',generate(doc,'xml')['app/src/main/java/com/example/agata/MainActivity.kt']);doc['android_settings']={'min_sdk':26,'target_sdk':35,'orientation':'landscape'};files=generate(doc);self.assertIn('minSdk = 26; targetSdk = 35',files['app/build.gradle.kts']);self.assertIn('screenOrientation="landscape"',files['app/src/main/AndroidManifest.xml'])
