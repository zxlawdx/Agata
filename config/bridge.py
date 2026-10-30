"""Operações explícitas expostas à WebView pelo bridge do Vela."""
from __future__ import annotations

from pathlib import Path

from vela.core.bridge import BaseBridge

from apps.workspace.repositories.json_repository import JsonProjectRepository
from apps.workspace.services.projects import ProjectService


def project_service() -> ProjectService:
    # Projetos do usuário são externos ao diretório do executável.
    root = Path.home() / "Yara" / "Projetos"
    return ProjectService(JsonProjectRepository(root))


class YaraBridge(BaseBridge):
    """Limite de confiança: nunca aceita caminhos ou comandos do frontend."""

    def list_projects(self) -> list[dict]:
        return project_service().list_projects()

    def create_project(self, payload: dict) -> dict:
        if not isinstance(payload, dict):
            raise ValueError("Dados do projeto inválidos.")
        return project_service().create_project(payload)

    def get_project(self, project_id: str) -> dict:
        return project_service().get_project(project_id)
