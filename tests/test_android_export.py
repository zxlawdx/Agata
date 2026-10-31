import copy
import json
import re
import tempfile
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile
from examples.android.create_example import example
from apps.android_designer.domain.model import new_node
from apps.android_designer.exporters.project import generate,export_project


class AndroidExportTests(unittest.TestCase):
    def test_compose_golden_and_navigation(self):
        files=generate(example(),'compose');golden=Path('examples/android/compose')
        for path,content in files.items():self.assertEqual(((golden/path).read_bytes() if isinstance(content,bytes) else (golden/path).read_text()),content,path)
        nav=next(v for k,v in files.items() if k.endswith('AppNavigation.kt'))
        self.assertIn('navController.navigate(target)',nav)
        self.assertIn('navController.popBackStack()',nav)
        self.assertEqual(nav.count('composable('),2)
        self.assertIn('rememberSaveable',files['app/src/main/java/com/example/agata/ui/screens/Screen_s_screen_0.kt'])

    def test_xml_resources_and_references(self):
        for backend in ['xml','compose']:
            files=generate(example(),backend);resources=set()
            for path,content in files.items():
                if path.endswith('.xml'):
                    tree=ET.fromstring(content)
                    if '/res/values/' in path:
                        resources.update((n.tag,n.attrib['name']) for n in tree if 'name' in n.attrib)
                    elif '/res/' in path:
                        for element in tree.iter():
                            for value in element.attrib.values():
                                if value.startswith('@+id/'):resources.add(('id',value[5:]))
                        resources.add((Path(path).parent.name,Path(path).stem))
            for path,content in files.items():
                if not isinstance(content,str):continue
                for kind,name in re.findall(r'@(string|color|drawable|layout)/([a-z0-9_]+)',content)+re.findall(r'R\.(string|color|drawable|layout|id)\.([a-z0-9_]+)',content):
                    self.assertIn((kind,name),resources,(path,kind,name))
            self.assertIn('namespace = "com.example.agata"',files['app/build.gradle.kts'])

    def test_code_escaping_and_screen_positions_do_not_change_exports(self):
        doc=example();doc['screens'][0]['root']['children'][1]['children'][0]['props']['text']='A "quote" \\ $name <&> café\nline'
        files=generate(doc);ET.fromstring(files['app/src/main/res/values/strings.xml'])
        shifted=copy.deepcopy(doc);shifted['screens'][0]['position']={'x':9999,'y':8888}
        other=generate(shifted)
        for key,value in files.items():
            if key!='agata-model.json':self.assertEqual(value,other[key])

    def test_custom_code_preserved_and_zip_is_real(self):
        doc=example();path='app/src/main/java/com/example/agata/Custom.kt';doc['custom_files']['compose/'+path]='package com.example.agata\nfun custom() = 42\n'
        self.assertEqual(generate(doc)[path],doc['custom_files']['compose/'+path])
        self.assertNotIn(path,generate(doc,'xml'))
        with tempfile.TemporaryDirectory(prefix='Espaço á ') as root:
            result=export_project(doc,'compose',root)
            with ZipFile(result['path']) as archive:self.assertEqual(archive.read('AgataExport/'+path).decode(),doc['custom_files']['compose/'+path])

    def test_missing_images_and_invalid_backend_reported(self):
        doc=example();doc['screens'][0]['root']['children'].append(new_node('Image'))
        with self.assertRaisesRegex(ValueError,'PNG'):generate(doc)
        with self.assertRaises(ValueError):generate(example(),'unknown')

    def test_kotlin_syntax_if_parser_available(self):
        try:
            from tree_sitter import Language,Parser
            import tree_sitter_kotlin
        except ImportError:self.skipTest('Install tree-sitter and tree-sitter-kotlin for syntax validation')
        parser=Parser(Language(tree_sitter_kotlin.language()))
        for backend in ['compose','xml']:
            for path,content in generate(example(),backend).items():
                if path.endswith(('.kt','.kts')):
                    tree=parser.parse(content.encode())
                    self.assertFalse(tree.root_node.has_error,(path,str(tree.root_node)))


    def test_all_registered_components_emit_projects_with_valid_xml(self):
        from apps.android_designer.domain.model import REGISTRY,new_document
        for kind in REGISTRY:
            if kind=='Image':continue
            doc=new_document();doc['screens'][0]['root']['children']=[new_node(kind)]
            if kind in {'Guideline','Barrier'}:
                parent=new_node('ConstraintLayout');target=new_node('TextLabel');helper=new_node(kind)
                if kind=='Barrier':helper['props']['references']=target['id']
                parent['children']=[target,helper];doc['screens'][0]['root']=parent
            for backend in ['compose','xml']:
                files=generate(doc,backend)
                for path,content in files.items():
                    if path.endswith('.xml'):ET.fromstring(content)
                self.assertIn('gradle/wrapper/gradle-wrapper.jar',files)

    def test_committed_codemirror_integrity_and_licenses(self):
        from hashlib import sha256
        root=Path('apps/android_designer/static/vendor')
        manifest=json.loads((root/'NOTICE.json').read_text())
        self.assertEqual(sha256((root/'codemirror.js').read_bytes()).hexdigest(),manifest['bundle_sha256'])
        for package in manifest['packages']:
            self.assertTrue((root/'licenses'/package['license_file']).is_file())
