"""Operações explícitas expostas à WebView pelo bridge do Vela."""
from __future__ import annotations

from pathlib import Path

from vela.core.bridge import BaseBridge

from apps.workspace.repositories.json_repository import JsonProjectRepository
from apps.workspace.services.projects import ProjectService
from apps.sketch_editor.services.sketches import SketchService


def project_repository() -> JsonProjectRepository:
    # Pasta externa ao executável: preservada após upgrades do Yara.
    return JsonProjectRepository(Path.home() / "Yara" / "Projetos")


def project_service() -> ProjectService:
    return ProjectService(project_repository())


class YaraBridge(BaseBridge):
    """A UI só passa IDs e dados; caminhos de arquivo são resolvidos no Python."""

    def list_projects(self) -> list[dict]:
        return project_service().list_projects()

    def create_project(self, payload: dict) -> dict:
        if not isinstance(payload, dict):
            raise ValueError("Dados do projeto inválidos.")
        return project_service().create_project(payload)

    def get_project(self, project_id: str) -> dict:
        return project_service().get_project(project_id)

    def save_sketch(self, project_id: str, payload: dict) -> dict:
        return SketchService(project_repository()).save(project_id, payload)
