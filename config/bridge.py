"""Operações explícitas expostas à WebView pelo bridge do Vela."""
from __future__ import annotations

from pathlib import Path

from vela.core.bridge import BaseBridge

from apps.workspace.repositories.json_repository import JsonProjectRepository
from apps.workspace.services.projects import ProjectService
from apps.sketch_editor.services.sketches import SketchService


def project_repository() -> JsonProjectRepository:
    # Projetos novos em Agata e acesso aos antigos, sem movê-los automaticamente.
    return JsonProjectRepository(
        Path.home() / "Agata" / "Projetos",
        legacy_root=Path.home() / "Yara" / "Projetos",
    )


def project_service() -> ProjectService:
    return ProjectService(project_repository())


class AgataBridge(BaseBridge):
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

    def export_artwork(self, project_id: str, file_format: str, data: str = "") -> dict:
        """Exporta o projeto salvo para SVG, PNG ou JSON na pasta local Exports."""
        from apps.sketch_editor.services.exports import ArtworkExporter
        return ArtworkExporter(project_repository()).export(project_id, file_format, data)


    def get_interface(self, project_id: str) -> dict:
        from apps.android_designer.services.documents import InterfaceService
        return InterfaceService(project_repository()).get(project_id)

    def save_interface(self, project_id: str, document: dict, revision: int) -> dict:
        from apps.android_designer.services.documents import InterfaceService
        return InterfaceService(project_repository()).save(project_id, document, revision)

    def generate_android(self, document: dict, backend: str) -> dict:
        from apps.android_designer.exporters.project import generate
        files=generate(document, backend)
        return {path:content for path,content in files.items() if isinstance(content,str)}

    def export_android(self, project_id: str, backend: str) -> dict:
        from apps.android_designer.services.documents import InterfaceService
        from apps.android_designer.exporters.project import export_project
        return export_project(InterfaceService(project_repository()).get(project_id)['document'], backend)


    def validate_interface(self, document: dict) -> dict:
        from apps.android_designer.domain.model import validate
        return {"ok": True, "document": validate(document)}
