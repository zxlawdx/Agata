import copy
import json
import tempfile
import unittest
from pathlib import Path
from apps.android_designer.domain.model import new_document,new_node,validate
from apps.android_designer.services.documents import InterfaceService
from apps.workspace.repositories.json_repository import JsonProjectRepository
from apps.workspace.services.projects import ProjectService
from examples.android.create_example import example


class AndroidModelTests(unittest.TestCase):
    def test_round_trip_and_legacy_drawings_preserved(self):
        with tempfile.TemporaryDirectory() as folder:
            repo=JsonProjectRepository(Path(folder)/'Projetos')
            project=ProjectService(repo).create_project({'name':'Legado'})
            project['screens'][0]['layers']=[{'id':'old','objects':[{'type':'path','path':[['M',0,0]]}]}]
            repo.save(project);before=copy.deepcopy(project['screens'])
            service=InterfaceService(repo);loaded=service.get(project['id'])
            doc=example();result=service.save(project['id'],doc,loaded['revision'])
            self.assertEqual(result['revision'],1)
            self.assertEqual(service.get(project['id'])['document'],doc)
            self.assertEqual(repo.get(project['id'])['screens'],before)
            with self.assertRaisesRegex(ValueError,'outra janela'):service.save(project['id'],doc,0)

    def test_invalid_ids_and_orphan_navigation_rejected(self):
        doc=example();doc['screens'][1]['id']=doc['screens'][0]['id']
        with self.assertRaises(ValueError):validate(doc)
        doc=example();doc['screens'][0]['root']['children'][3]['events']['onClick']['target']='missing'
        with self.assertRaisesRegex(ValueError,'destino'):validate(doc)

    def test_reject_future_version_and_bad_namespace(self):
        doc=new_document();doc['version']=99
        with self.assertRaises(ValueError):validate(doc)
        doc=new_document();doc['namespace']='com.class.app'
        with self.assertRaises(ValueError):validate(doc)

    def test_custom_source_cannot_escape_project(self):
        doc=new_document();doc['custom_files']={'../../outside.kt':'code'}
        with self.assertRaises(ValueError):validate(doc)

    def test_deep_nesting_and_bad_property_rejected(self):
        doc=new_document();n=doc['screens'][0]['root']
        for _ in range(30):c=new_node('Column');n['children'].append(c);n=c
        with self.assertRaises(ValueError):validate(doc)
        doc=new_document();doc['screens'][0]['root']['layout']['width']='arbitrary Kotlin'
        with self.assertRaises(ValueError):validate(doc)
