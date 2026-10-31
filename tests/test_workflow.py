import copy,unittest
from xml.etree import ElementTree as ET
import tree_sitter,tree_sitter_kotlin
from apps.android_designer.domain.model import new_document,new_node,validate,walk
from apps.android_designer.domain.templates import TEMPLATES,template_document
from apps.android_designer.exporters.project import generate


class WorkflowTests(unittest.TestCase):
    def test_every_template_has_navigation_and_exports_parsable_native_source(self):
        parser=tree_sitter.Parser(tree_sitter.Language(tree_sitter_kotlin.language()))
        for key in TEMPLATES:
            d=template_document(key);self.assertGreaterEqual(len(d['screens']),1 if key in {'empty-activity','material3-starter'} else 2)
            for backend in ['compose','xml']:
                files=generate(d,backend)
                for path,content in files.items():
                    if path.endswith('.xml'):ET.fromstring(content)
                    if path.endswith('.kt'):self.assertFalse(parser.parse(content.encode()).root_node.has_error,(key,path))
    def test_graphics_are_native_vectors_not_bitmaps_and_invalid_data_rejects(self):
        d=new_document();canvas=new_node('DrawingCanvas');shape=new_node('Shape',{'kind':'path','rotation':30,'path':[['M',0,0],['C',10,20,30,40,90,50]]});canvas['children']=[shape];chart=new_node('Chart');d['screens'][0]['root']['children']=[canvas,chart]
        for backend in ['compose','xml']:
            files=generate(d,backend);native='\n'.join(v for k,v in files.items() if k.endswith('.kt'))
            self.assertIn('canvas.drawPath',native);self.assertIn('canvas.rotate',native);self.assertNotIn('BitmapFactory',native)
        chart['props']['series'][0]['values']=[float('nan')]
        with self.assertRaises(ValueError):validate(d)
    def test_all_chart_kinds_emit_and_empty_data_has_state(self):
        from apps.android_designer.domain.graphics import CHARTS
        for kind in CHARTS:
            d=new_document();chart=new_node('Chart',{'kind':kind});d['screens'][0]['root']['children']=[chart]
            self.assertTrue(generate(d,'compose'))
        chart['props']['series']=[]
        self.assertIn('Sem dados','\n'.join(v for v in generate(d,'xml').values() if isinstance(v,str)))
    def test_broken_event_can_save_but_export_requires_repair(self):
        d=new_document();button=new_node('Button');button['events']={'onClick':{'action':'navigate','target':'s_deleted','broken':True}};d['screens'][0]['root']['children']=[button]
        validate(d)
        with self.assertRaisesRegex(ValueError,'quebrado'):generate(d)
        button['events']['onClick'].pop('broken')
        with self.assertRaisesRegex(ValueError,'destino'):validate(d)
    def test_policies_validation_and_custom_xml_are_verified(self):
        d=template_document('authentication');login=d['screens'][1];button=next(n for n in login['root']['children'] if n['type']=='Button');button['events']['onClick']['policy']='replace'
        files=generate(d);self.assertIn('replace','\n'.join(v for v in files.values() if isinstance(v,str)));self.assertIn('EMAIL_ADDRESS','\n'.join(v for v in files.values() if isinstance(v,str)))
        d['custom_files']={'xml/app/src/main/res/layout/manual.xml':'<broken>'}
        with self.assertRaisesRegex(ValueError,'XML personalizado'):validate(d)
    def test_weight_error_identifies_origin(self):
        d=new_document();d['screens'][0]['root']['layout']['weight']=390
        with self.assertRaisesRegex(ValueError,'weight=390'):validate(d)
