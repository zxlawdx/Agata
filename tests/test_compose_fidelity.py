"""Semantic/style acceptance against the user's actual three-file Spotify project."""
from pathlib import Path
import copy,json,tempfile,unittest,hashlib
from apps.workspace.services.project_import.compose import ComposeParser
from apps.workspace.services.project_import.resources import resolve_resources
from apps.workspace.services.project_import.coordinator import ImportCoordinator
from apps.workspace.repositories.json_repository import JsonProjectRepository
from apps.android_designer.domain.model import walk,validate
from apps.android_designer.exporters.project import generate
from apps.workspace.services.project_import.source_patch import patch_sources

def parse(files):return ComposeParser(files,resolve_resources({})[0]).parse()
def spotify():return {p.name:p.read_text() for p in Path('examples/spotify_import').glob('*.kt')}

class ComposeFidelityTests(unittest.TestCase):
 def test_actual_three_screens_and_four_reusable_definitions(self):
  d=parse(spotify());self.assertEqual([s['name'] for s in d['screens']],['Home','Login','Dashboard']);defs=d['compose_project']['definitions'];helpers=[x['name'] for x in defs.values() if x['kind']=='Reusable Component'];self.assertCountEqual(helpers,['AgataHero','AgataPanel','AgataAction','MetricCard']);self.assertEqual(len([n for n in walk(d['screens'][0]['root']) if n.get('compose',{}).get('instance')]),6)
 def test_object_tokens_cross_file_callback_and_modifier_parameters(self):
  d=parse(spotify());home=d['screens'][0];nodes=list(walk(home['root']));self.assertIn('#1ED760',[n['props'].get('color') for n in nodes]);button=next(n for n in nodes if n['type']=='Button');self.assertEqual(button['props']['background'],'#1ED760');self.assertEqual(button['events']['onClick']['target'],d['screens'][1]['id']);self.assertEqual(button['layout']['minHeight'],52);self.assertEqual(button['layout']['width'],'fill');self.assertIn('heightIn',[op['type'] for op in button['compose']['modifiers']]);self.assertTrue(any('AgataDark.accent' in b.get('expression','') for n in nodes for b in n.get('compose',{}).get('styles',{}).values()))
 def test_ordered_modifiers_no_duplicated_prefixes_and_gradient(self):
  d=parse(spotify());hero=next(n for n in walk(d['screens'][0]['root']) if n['name']=='Column' and any(op['type']=='background' and isinstance(op['values'][0] if op['values'] else None,dict) for op in n.get('compose',{}).get('modifiers',[])));ops=hero['compose']['modifiers'];self.assertEqual([o['type'] for o in ops],['fillMaxWidth','background','padding']);self.assertEqual(ops[1]['values'][0]['colors'],['#175E3C','#252D2B','#191B1F']);self.assertEqual(ops[1]['values'][1]['radius'],22)
 def test_static_layout_alias_branches_preserved_inside_one_screen(self):
  d=parse(spotify());rules=[n['compose']['conditional']['rule'] for n in walk(d['screens'][0]['root']) if n.get('compose',{}).get('conditional')];self.assertEqual(len(rules),2);self.assertTrue(all(r['value']==700 for r in rules));dashboard=d['screens'][2];self.assertEqual(next(n['compose']['conditional']['rule']['value'] for n in walk(dashboard['root']) if n.get('compose',{}).get('conditional')),610)
 def test_theme_styles_typography_and_explicit_precedence(self):
  f={'Color.kt':'package demo\nval Green = Color(0xFF1DB954)','Home.kt':'package demo\nval colors = darkColorScheme(primary=Green, onSurface=Color.White)\nval type = Typography(headlineLarge=TextStyle(fontSize=28.sp,lineHeight=34.sp))\n@Composable fun Home(){ MaterialTheme(colorScheme=colors,typography=type) { Column { Text("Dashboard",style=MaterialTheme.typography.headlineLarge,fontSize=30.sp,color=MaterialTheme.colorScheme.onSurface) } } }'};d=parse(f);text=next(n for n in walk(d['screens'][0]['root']) if n['type']=='TextLabel');self.assertEqual(text['props']['fontSize'],30);self.assertEqual(text['props']['color'],'#FFFFFF');self.assertEqual(text['compose']['styles']['lineHeight']['value'],34);self.assertEqual(d['theme']['primary'],'#1DB954')
 def test_dynamic_expression_is_not_claimed_resolved(self):
  d=parse({'A.kt':'@Composable fun Home(){ Text("Hi",color=viewModel.color) }'});text=next(n for n in walk(d['screens'][0]['root']) if n['type']=='TextLabel');self.assertEqual(text['compose']['styles']['color']['status'],'Dynamic');self.assertEqual(text['compose']['styles']['color']['expression'],'viewModel.color')
 def test_bounded_recursive_custom_composable_has_placeholder(self):
  d=parse({'A.kt':'@Composable fun Home(){ Loop() }\n@Composable fun Loop(){ Column { Loop() } }'});self.assertTrue(any(n.get('compose',{}).get('placeholder') for n in walk(d['screens'][0]['root'])))
 def test_scalar_patch_is_utf8_safe_and_conflict_aware(self):
  text='@Composable fun Home(){ Column { Text("Olá",color=Color.White) } }';d=parse({'A.kt':text});node=next(n for n in walk(d['screens'][0]['root']) if n['type']=='TextLabel');node['props']['text']='Música';sources,conflicts=patch_sources(d,{'A.kt':text.encode()});self.assertFalse(conflicts);self.assertIn('Text("Música"',sources['A.kt'].decode());unchanged,conflicts=patch_sources(d,{'A.kt':(text+'// changed').encode()});self.assertTrue(conflicts);self.assertEqual(unchanged['A.kt'],(text+'// changed').encode())
 def test_shared_instance_patch_preserves_definition_and_other_instances(self):
  text='@Composable fun Home(){ Column { Label("A"); Label("B") } }\n@Composable fun Label(text:String){ Text(text,color=Color.White) }';d=parse({'A.kt':text});labels=[n for n in walk(d['screens'][0]['root']) if n['type']=='TextLabel'];labels[0]['props']['text']='Changed';sources,conflicts=patch_sources(d,{'A.kt':text.encode()});self.assertFalse(conflicts);self.assertIn('Label("Changed"); Label("B")',sources['A.kt'].decode());self.assertIn('fun Label(text:String){ Text(text,color=Color.White) }',sources['A.kt'].decode());self.assertEqual(labels[1]['props']['text'],'B')
 def test_actual_save_export_reimport_preserves_ids_styles_and_sources(self):
  with tempfile.TemporaryDirectory() as temp:
   repo=JsonProjectRepository(Path(temp)/'projects');imports=ImportCoordinator(repo);preview=imports.analyze(files={p:v.encode() for p,v in spotify().items()});project=imports.confirm(preview['token']);document=repo.get(project['id'])['interface_document'];button=next(n for n in walk(document['screens'][0]['root']) if n['type']=='Button');button['props']['background']='#00AA55';validate(document);files=generate(document);new=imports.analyze(files={p:v.encode() if isinstance(v,str) else v for p,v in files.items()});second=imports.confirm(new['token']);loaded=repo.get(second['id'])['interface_document'];self.assertEqual(loaded['screens'],document['screens']);self.assertEqual(loaded['compose_project'],document['compose_project']);self.assertEqual(len(loaded['screens']),3)
 def test_reference_harness_keeps_original_sources_byte_for_byte(self):
  from scripts.build_spotify_reference import prepare
  with tempfile.TemporaryDirectory() as temp:
   output=prepare(Path(temp)/'reference')
   for path in Path('examples/spotify_import').glob('*.kt'):self.assertEqual((output/'app/src/main/java/com/example/agata/ui/screens'/path.name).read_bytes(),path.read_bytes())
   with self.assertRaises(ValueError):prepare(output)
 def test_resource_night_variant_and_symbol_privacy(self):
  resources=resolve_resources({'app/src/main/res/values/colors.xml':b'<resources><color name="primary">#ffffff</color></resources>','app/src/main/res/values-night/colors.xml':b'<resources><color name="primary">#101114</color></resources>'})[0]
  d=ComposeParser({'Home.kt':'@Composable fun Home(){ Text("Hi", color = colorResource(R.color.primary)) }'},resources).parse();text=next(n for n in walk(d['screens'][0]['root']) if n['type']=='TextLabel');self.assertEqual(text['compose']['styles']['color']['by_mode'],{'light':'#FFFFFF','dark':'#101114'})
  d=parse({'A.kt':'package demo\nprivate val Secret = Color.White','B.kt':'package demo\n@Composable fun Home(){ Text("Hi",color=Secret) }'});text=next(n for n in walk(d['screens'][0]['root']) if n['type']=='TextLabel');self.assertEqual(text['compose']['styles']['color']['status'],'Dynamic')
 def test_matching_scoped_symbols_and_preview_dynamic_theme(self):
  d=parse({'A.kt':'package demo\nval Green=Color(0xFF00AA00)','B.kt':'package demo\n@Composable fun Home(){ val foreground = if (isSystemInDarkTheme()) Color.White else Color.Black; Column { Text("Hi",color=foreground) } }'});text=next(n for n in walk(d['screens'][0]['root']) if n['type']=='TextLabel');self.assertEqual(text['compose']['styles']['color']['by_mode'],{'light':'#000000','dark':'#FFFFFF'})
 def test_partial_material_color_is_not_fully_resolved(self):
  d=parse({'A.kt':'@Composable fun Home(){ Button(colors=ButtonDefaults.buttonColors(containerColor=vm.color,contentColor=Color.White),onClick={}){ Text("Hi") } }'});button=next(n for n in walk(d['screens'][0]['root']) if n['type']=='Button');self.assertEqual(button['compose']['styles']['materialColors']['status'],'Partially supported');self.assertEqual(button['compose']['styles']['containerColor']['status'],'Dynamic')
 def test_label_slot_safe_patch_targets_literal_inside_lambda(self):
  text='@Composable fun Home(){ OutlinedTextField(value="",onValueChange={},label={Text("Email")}) }';d=parse({'A.kt':text});field=next(n for n in walk(d['screens'][0]['root']) if n['type']=='TextField');field['props']['label']='Novo';sources,conflicts=patch_sources(d,{'A.kt':text.encode()});self.assertFalse(conflicts);self.assertIn('label={Text("Novo")}',sources['A.kt'].decode())
 def test_material_container_edit_and_theme_reference_are_emitted(self):
  d=parse({'A.kt':'val palette=darkColorScheme(onSurface=Color.White)\n@Composable fun Home(){ Column { Text("Hi",color=MaterialTheme.colorScheme.onSurface); Button(colors=ButtonDefaults.buttonColors(containerColor=Color.Red),onClick={}) { Text("Go") } } }'});button=next(n for n in walk(d['screens'][0]['root']) if n['type']=='Button');button['props']['background']='#00AA55';files=generate(d);code='\n'.join(v for k,v in files.items() if k.endswith('.kt'));self.assertIn('containerColor = Color(0xFF00AA55)',code);self.assertIn('color = MaterialTheme.colorScheme.onSurface',code)
