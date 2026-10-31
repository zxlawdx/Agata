"""Compatibilidade de projetos locais após a renomeação para Agata."""
import tempfile
import unittest
from pathlib import Path
from apps.workspace.repositories.json_repository import JsonProjectRepository
from apps.workspace.services.projects import ProjectService
from config import settings

class AgataCompatibilityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.new = root / "Agata" / "Projetos"
        self.old = root / "Yara" / "Projetos"
        self.legacy = JsonProjectRepository(self.old)
        self.repo = JsonProjectRepository(self.new, legacy_root=self.old)

    def test_old_project_visible_without_copy(self):
        project = ProjectService(self.legacy).create_project({"name": "Projeto antigo"})
        self.assertEqual(self.repo.get(project["id"])["name"], "Projeto antigo")
        self.assertFalse(self.new.exists())
        self.assertEqual(len(self.repo.list()), 1)

    def test_saving_old_project_stays_in_old_directory(self):
        project = ProjectService(self.legacy).create_project({"name": "Antes"})
        doc = self.repo.get(project["id"])
        doc["name"] = "Editado"
        self.repo.save(doc)
        self.assertEqual(self.legacy.get(project["id"])["name"], "Editado")
        self.assertFalse((self.new / project["id"] / "project.json").exists())

    def test_new_project_is_written_to_agata(self):
        ProjectService(self.legacy).create_project({"name": "Antigo"})
        project = ProjectService(self.repo).create_project({"name": "Novo"})
        self.assertTrue((self.new / project["id"] / "project.json").is_file())
        self.assertEqual(len(self.repo.list()), 2)

    def test_brand_and_legacy_extensions(self):
        self.assertEqual(settings.APP_TITLE, "Agata")
        self.assertIn(".agata", settings.APP_FILE_EXTENSIONS)
        self.assertIn(".yara", settings.APP_FILE_EXTENSIONS)

    def test_invalid_project_ids_remain_rejected(self):
        with self.assertRaises(ValueError):
            self.repo.get("../../segredo")
