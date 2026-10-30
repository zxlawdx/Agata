"""Testes de persistência, camadas e proteção contra entradas inválidas."""
import tempfile
import unittest
from pathlib import Path

from apps.sketch_editor.services.sketches import SketchService
from apps.workspace.repositories.json_repository import JsonProjectRepository
from apps.workspace.services.projects import ProjectService


class SketchServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        repo = JsonProjectRepository(Path(self.temp.name))
        self.project = ProjectService(repo).create_project({"name": "Meu esboço"})
        self.repo = repo
        self.service = SketchService(repo)

    def payload(self):
        return {
            "active_layer_id": "sidebar",
            "layers": [
                {"id": "fundo", "name": "Fundo", "visible": True, "locked": True,
                 "objects": [{"type": "rect", "left": 0, "fill": "#ffffff"}]},
                {"id": "sidebar", "name": "Sidebar", "visible": True, "locked": False,
                 "objects": [{"type": "path", "path": [["M", 1, 1], ["L", 3, 4]]}]},
            ],
        }

    def test_salva_reabre_e_preserva_estrutura_de_camadas(self):
        result = self.service.save(self.project["id"], self.payload())
        self.assertTrue(result["ok"])
        doc = self.repo.get(self.project["id"])
        screen = doc["screens"][0]
        self.assertEqual(screen["active_layer_id"], "sidebar")
        self.assertEqual(screen["layers"][0]["name"], "Fundo")
        self.assertTrue(screen["layers"][0]["locked"])
        self.assertEqual(screen["layers"][1]["objects"][0]["type"], "path")
        self.assertEqual(doc["canvas"]["width"], 390)
        self.assertEqual(doc["screens"][0]["elements"], [])

    def test_nao_aceita_camadas_duplicadas(self):
        payload = self.payload()
        payload["layers"][1]["id"] = "fundo"
        with self.assertRaises(ValueError):
            self.service.save(self.project["id"], payload)

    def test_nao_aceita_camada_ativa_inexistente(self):
        payload = self.payload()
        payload["active_layer_id"] = "qualquer"
        with self.assertRaises(ValueError):
            self.service.save(self.project["id"], payload)

    def test_nao_aceita_lista_de_objetos_invalidos(self):
        payload = self.payload()
        payload["layers"][0]["objects"] = [12]
        with self.assertRaises(ValueError):
            self.service.save(self.project["id"], payload)

    def test_nao_aceita_objeto_com_numero_nao_finito(self):
        payload = self.payload()
        payload["layers"][0]["objects"] = [{"left": float("nan")}]
        with self.assertRaises(ValueError):
            self.service.save(self.project["id"], payload)

    def test_projeto_antigo_sem_layers_e_compativel(self):
        old = self.repo.get(self.project["id"])
        self.assertNotIn("layers", old["screens"][0])
        self.service.save(self.project["id"], self.payload())
        self.assertIn("layers", self.repo.get(self.project["id"])["screens"][0])


if __name__ == "__main__":
    unittest.main()
