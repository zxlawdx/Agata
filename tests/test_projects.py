"""Testes de domínio, executáveis sem WebView."""
import tempfile
import unittest
from pathlib import Path

from apps.workspace.repositories.json_repository import JsonProjectRepository
from apps.workspace.services.projects import ProjectService


class ProjectServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = JsonProjectRepository(Path(self.temp.name))
        self.service = ProjectService(self.repo)

    def test_cria_e_reabre_projeto_com_tela_vazia(self):
        project = self.service.create_project(
            {"name": "App Saúde", "platform": "android", "width": 390, "height": 844}
        )
        loaded = self.service.get_project(project["id"])
        self.assertEqual(loaded["name"], "App Saúde")
        self.assertEqual(loaded["screens"][0]["elements"], [])
        self.assertEqual(loaded["canvas"]["height"], 844)
        self.assertEqual(self.service.list_projects()[0]["id"], project["id"])

    def test_rejeita_dimensoes_inseguras(self):
        with self.assertRaises(ValueError):
            self.service.create_project(
                {"name": "Erro", "platform": "android", "width": 99999, "height": 844}
            )

    def test_rejeita_nome_vazio(self):
        with self.assertRaises(ValueError):
            self.service.create_project({"name": "  "})

    def test_rejeita_acesso_a_arquivos_fora_do_workspace(self):
        with self.assertRaises(ValueError):
            self.repo.get("../../segredo")

    def test_lista_vazia_sem_criar_diretorio(self):
        # TemporaryDirectory() cria sua própria raiz. O repositório de projetos
        # fica numa subpasta ainda inexistente, que a listagem não deve criar.
        repo = JsonProjectRepository(Path(self.temp.name) / "Projetos")
        service = ProjectService(repo)
        self.assertFalse(repo.root.exists())
        self.assertEqual(service.list_projects(), [])
        self.assertFalse(repo.root.exists())


if __name__ == "__main__":
    unittest.main()
