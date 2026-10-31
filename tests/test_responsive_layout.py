import copy,json,unittest
from xml.etree import ElementTree as ET
from apps.android_designer.domain.model import validate,resolve_screen,new_node
from apps.android_designer.exporters.project import generate
from examples.android.create_responsive_example import example


class ResponsiveLayoutTests(unittest.TestCase):
    def test_v1_migrates_additively_preserving_ids_and_events(self):
        doc=example();old=copy.deepcopy(doc);old['version']=1
        from apps.android_designer.domain.model import walk
        keys={'width','height','padding','gap','alignment','arrangement','scroll','weight'}
        for screen in old['screens']:
            # v1 did not contain Grid; keep only the essential original components.
            screen['root']['children']=[c for c in screen['root']['children'] if c['type']!='Grid']
            for node in walk(screen['root']):
                node['layout']={k:v for k,v in node['layout'].items() if k in keys}
                if node['type']=='TextLabel':node['props'].pop('maxLines');node['props'].pop('overflow')
        before=copy.deepcopy(old);migrated=validate(old)
        self.assertEqual(old,before);self.assertEqual(migrated['version'],2)
        self.assertEqual(migrated['screens'][0]['root']['children'][2]['events'],old['screens'][0]['root']['children'][2]['events'])
        self.assertEqual(migrated['screens'][0]['id'],old['screens'][0]['id'])

    def test_breakpoints_are_independent_and_landscape_overrides_are_last(self):
        doc=example();root=doc['screens'][0]['root'];root['layout']['responsive']={'medium':{'padding':32},'landscape':{'padding':8}}
        self.assertEqual(resolve_screen(doc['screens'][0],700,1000)['root']['layout']['padding'],32)
        self.assertEqual(resolve_screen(doc['screens'][0],700,300)['root']['layout']['padding'],8)
        self.assertEqual(root['layout']['padding'],16)

    def test_conflicting_constraints_and_bad_free_modes_rejected(self):
        for changes in [{'minWidth':800,'maxWidth':100},{'mode':'free'},{'aspectRatio':-1},{'columns':0}]:
            doc=example();doc['screens'][0]['root']['layout'].update(changes)
            with self.assertRaises(ValueError):validate(doc)
        doc=example();doc['screens'][0]['root']['layout']['responsive']={'tablet':{'width':'fill'}}
        with self.assertRaises(ValueError):validate(doc)

    def test_compose_maps_constraints_grid_free_box_and_adaptive_branches(self):
        files=generate(example(),'compose');source='\n'.join(c for p,c in files.items() if p.endswith('.kt'))
        for token in ['.widthIn(','Modifier.weight(1f)','BoxWithConstraints','maxWidth >= 600.dp','maxWidth >= 840.dp','.offset(','Alignment.TopStart']:self.assertIn(token,source)
        doc=example();doc['screens'][0]['root']['children'][3]['layout']['aspectRatio']=2
        self.assertIn('.aspectRatio(2.0f)','\n'.join(v for k,v in generate(doc).items() if k.endswith('.kt')))

    def test_xml_emits_qualified_layouts_constraints_and_native_grid(self):
        files=generate(example(),'xml');layouts={p:c for p,c in files.items() if '/res/layout' in p}
        self.assertTrue(any('layout-w600dp/' in p for p in layouts));self.assertTrue(any('layout-w840dp-land/' in p for p in layouts))
        source='\n'.join(layouts.values());self.assertIn('GridLayout',source);self.assertIn('constraintlayout.widget.ConstraintLayout',source);self.assertIn('layout_constraintWidth_max',source);self.assertIn('layout_gravity',source)
        for content in layouts.values():ET.fromstring(content)
        self.assertIn('androidx.constraintlayout:constraintlayout:2.2.1',files['app/build.gradle.kts'])

    def test_xml_reports_wrap_conversion_instead_of_claiming_fidelity(self):
        doc=example();row=next(n for n in doc['screens'][0]['root']['children'] if n['type']=='Row');row['layout']['wrap']=True
        diagnostics=json.loads(generate(doc,'xml')['agata-export-diagnostics.json'])
        self.assertTrue(diagnostics['warnings']);self.assertIn('wrap',diagnostics['warnings'][0]['message'])

    def test_responsive_kotlin_syntax(self):
        try:
            from tree_sitter import Parser,Language
            import tree_sitter_kotlin
        except ImportError:self.skipTest('Kotlin parser not installed')
        parser=Parser(Language(tree_sitter_kotlin.language()))
        for path,content in generate(example()).items():
            if path.endswith(('.kt','.kts')):self.assertFalse(parser.parse(content.encode()).root_node.has_error,path)
