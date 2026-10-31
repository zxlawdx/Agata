"""Testes de modos de editor e exportação local."""
import base64
import tempfile
import unittest
from pathlib import Path

from apps.workspace.repositories.json_repository import JsonProjectRepository
from apps.workspace.services.projects import ProjectService
from apps.sketch_editor.services.exports import ArtworkExporter


class EditorModeAndExportTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root=Path(self.tmp.name)
        self.repo=JsonProjectRepository(root/"projects")
        self.exporter=ArtworkExporter(self.repo,root/"exports")
        self.service=ProjectService(self.repo)
        self.project=self.service.create_project({
            "name":"Picadeiro", "platform":"desktop",
            "editor_mode":"svg","width":512,"height":512
        })

    def test_mode_is_persisted(self):
        self.assertEqual(self.repo.get(self.project["id"])["editor_mode"],"svg")

    def test_reject_unknown_mode(self):
        with self.assertRaises(ValueError):
            self.service.create_project({"name":"x","editor_mode":"invalid"})

    def test_json_export(self):
        result=self.exporter.export(self.project["id"],"json")
        self.assertTrue(result["ok"])
        self.assertIn('"editor_mode": "svg"',Path(result["path"]).read_text())

    def test_svg_export(self):
        result=self.exporter.export(self.project["id"],"svg",'<svg xmlns="http://www.w3.org/2000/svg"><rect width="2" height="2"/></svg>')
        self.assertTrue(Path(result["path"]).exists())

    def test_svg_reject_scripts(self):
        with self.assertRaises(ValueError):
            self.exporter.export(self.project["id"],"svg",'<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')

    def test_png_export(self):
        png=b"\x89PNG\r\n\x1a\n"+b"payload"
        data="data:image/png;base64,"+base64.b64encode(png).decode("ascii")
        result=self.exporter.export(self.project["id"],"png",data)
        self.assertEqual(Path(result["path"]).read_bytes(),png)
