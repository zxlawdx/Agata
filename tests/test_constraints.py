import copy,unittest
from xml.etree import ElementTree as ET
from apps.android_designer.domain.model import validate,new_node,walk
from apps.android_designer.domain.tutorial_project import tutorial_document
from apps.android_designer.exporters.project import generate


class ConstraintTests(unittest.TestCase):
    def test_tutorial_is_semantic_and_exports_both(self):
        d=tutorial_document();self.assertEqual(len(d['screens']),3)
        root=d['screens'][0]['root'];button=root['children'][-1]
        self.assertEqual(button['layout']['horizontalBias'],.5)
        for backend in ('xml','compose'):
            files=generate(d,backend)
            if backend=='xml':
                layout=ET.fromstring(files[f'app/src/main/res/layout/{d["start_screen"]}.xml']);self.assertEqual(layout.tag,'androidx.constraintlayout.widget.ConstraintLayout')
                self.assertIn('layout_constraintStart_toStartOf',ET.tostring(layout).decode());self.assertIn('Guideline',ET.tostring(layout).decode())
            else:
                code='\n'.join(v for p,v in files.items() if p.endswith('.kt'))
                self.assertIn('createGuidelineFromStart',code);self.assertIn('.constrainAs(',code);self.assertIn('horizontalBias = 0.5f',code)
    def test_invalid_axes_cycles_and_baseline_rejected(self):
        d=tutorial_document();p=d['screens'][0]['root'];button=p['children'][-1];button['layout']['constraints']['start']['anchor']='top'
        with self.assertRaisesRegex(ValueError,'Eixos'):validate(d)
        d=tutorial_document();p=d['screens'][0]['root'];a,b=p['children'][:2];a['layout']['constraints']['top']={'target':b['id'],'anchor':'bottom','margin':0};b['layout']['constraints']['top']={'target':a['id'],'anchor':'bottom','margin':0}
        with self.assertRaisesRegex(ValueError,'Ciclo'):validate(d)
    def test_barrier_exports_and_references_are_validated(self):
        d=tutorial_document();p=d['screens'][0]['root'];barrier=new_node('Barrier');barrier['props']['references']=p['children'][0]['id'];p['children'].append(barrier)
        for backend in ('xml','compose'):
            files=generate(d,backend);self.assertIn('Barrier','\n'.join(v for v in files.values() if isinstance(v,str)))
        barrier['props']['references']='n_missing'
        with self.assertRaisesRegex(ValueError,'Barrier'):validate(d)
    def test_layers_do_not_reorder_semantics_and_are_exported(self):
        d=tutorial_document();s=d['screens'][0];order=[n['id'] for n in s['root']['children']];s['layers'][-1]['opacity']=.4;s['layers'].reverse();files=generate(d,'xml');text=files[f'app/src/main/res/layout/{s["id"]}.xml'];self.assertIn('alpha="0.4"',text);self.assertIn('translationZ=',text);self.assertEqual([n['id'] for n in s['root']['children']],order)
        s['layers'][0]['nodes'].append('n_missing')
        with self.assertRaisesRegex(ValueError,'camada'):validate(d)
    def test_generated_kotlin_parses(self):
        import tree_sitter,tree_sitter_kotlin
        parser=tree_sitter.Parser(tree_sitter.Language(tree_sitter_kotlin.language()))
        for path,code in generate(tutorial_document(),'compose').items():
            if path.endswith('.kt'):self.assertFalse(parser.parse(code.encode()).root_node.has_error,path)

    def test_v2_migration_preserves_identity_and_adds_only_defaults(self):
        d=tutorial_document();d['screens']=d['screens'][1:];d['start_screen']=d['screens'][0]['id'];d['version']=2
        for s in d['screens']:
            s.pop('layers',None)
            for n in walk(s['root']):
                for key in ('constraints','horizontalBias','verticalBias'):n['layout'].pop(key)
                n['events']={}
        original=copy.deepcopy(d);clean=validate(d)
        self.assertEqual(d,original);self.assertEqual(clean['version'],4)
        self.assertEqual(clean['screens'][0]['root']['id'],d['screens'][0]['root']['id'])
        self.assertEqual(clean['screens'][0]['layers'],[])

    def test_hidden_layer_remains_hidden_under_responsive_override(self):
        from apps.android_designer.domain.constraints import layered_screen
        from apps.android_designer.domain.model import resolve_screen
        d=tutorial_document();s=d['screens'][0];layer=s['layers'][-1];layer['visible']=False
        button=s['root']['children'][-1];button['layout']['responsive']={'expanded':{'visible':True}}
        resolved=resolve_screen(layered_screen(s),1200,900)
        self.assertFalse(resolved['root']['children'][-1]['layout']['visible'])
