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
        from apps.workspace.services.manager import ProjectManager
        return ProjectManager(project_repository()).list()

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
        project=project_repository().get(project_id)
        if project.get('source_import'):
            from apps.workspace.services.project_import.export import imported_export
            return imported_export(project_repository(),project_id,backend)
        return export_project(InterfaceService(project_repository()).get(project_id)['document'], backend)


    def validate_interface(self, document: dict) -> dict:
        from apps.android_designer.domain.model import validate
        return {"ok": True, "document": validate(document)}

    def project_action(self, project_id: str, action: str, value=None):
        from apps.workspace.services.manager import ProjectManager
        return ProjectManager(project_repository()).action(project_id,action,value)

    def open_existing_project(self, path: str):
        from apps.workspace.services.manager import ProjectManager
        return ProjectManager(project_repository()).open(path)

    def inspect_project_import(self, path: str):
        from apps.workspace.services.project_import.coordinator import ImportCoordinator
        return ImportCoordinator(project_repository()).analyze(path)

    def upload_project_import(self, name: str, data: str):
        from apps.workspace.services.project_import.coordinator import ImportCoordinator
        return ImportCoordinator(project_repository()).upload(name,data)

    def upload_project_sources(self, files):
        from apps.workspace.services.project_import.coordinator import ImportCoordinator
        return ImportCoordinator(project_repository()).upload_sources(files)

    def confirm_project_import(self, token: str, name=None, initialize=False, screen_ids=None):
        from apps.workspace.services.project_import.coordinator import ImportCoordinator
        return ImportCoordinator(project_repository()).confirm(token,name,initialize,screen_ids)

    def cancel_project_import(self, token: str):
        from apps.workspace.services.project_import.coordinator import ImportCoordinator
        return ImportCoordinator(project_repository()).cancel(token)

    def project_source(self, project_id: str, path: str):
        from apps.workspace.services.project_import.coordinator import ImportCoordinator
        return ImportCoordinator(project_repository()).source(project_id,path)

    def save_project_source(self, project_id: str, path: str, content: str, expected_sha: str):
        from apps.workspace.services.project_import.coordinator import ImportCoordinator
        return ImportCoordinator(project_repository()).save_source(project_id,path,content,expected_sha)

    def reanalyze_project(self, project_id: str):
        from apps.workspace.services.project_import.coordinator import ImportCoordinator
        return ImportCoordinator(project_repository()).reanalyze(project_id)

    def choose_project_path(self, kind='folder'):
        import webview
        if not webview.windows:raise ValueError('Seletor disponível apenas na aplicação desktop. Use o caminho ou upload.')
        files=webview.windows[0].create_file_dialog(webview.FileDialog.FOLDER if kind=='folder' else webview.FileDialog.OPEN,allow_multiple=False)
        return files[0] if files else None

    def export_imported_android(self, project_id: str, backend: str, activate=False):
        from apps.workspace.services.project_import.export import imported_export
        return imported_export(project_repository(),project_id,backend,activate)
