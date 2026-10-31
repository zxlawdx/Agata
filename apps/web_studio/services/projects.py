"""Application services over the existing repository, scanner and real Web files."""

from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
from uuid import uuid4
import json, shutil
from apps.workspace.services.projects import ProjectService
from apps.workspace.services.manager import ProjectManager
from apps.workspace.services.project_import.scanner import snapshot
from ..domain.files import encode, safe_path, validate_files
from .storage import WebWorkspace
from .templates import (
    template_files,
    block_catalog,
    BASE_CSS,
    LAYOUT_CSS,
    COMPONENTS_CSS,
    RESPONSIVE_CSS,
    INTERACTIONS_JS,
)
from apps.design_system.services.tokens import tokens, css_tokens
from apps.template_registry.registry import catalog


class WebProjectService:
    def __init__(self, repository):
        self.repository = repository

    def create(self, name, template="saas-dashboard"):
        files, metadata = template_files(template)
        project = ProjectService(self.repository).create_project(
            {
                "name": name,
                "platform": "web",
                "width": 1440,
                "height": 900,
                "editor_mode": "drawing",
            }
        )
        project.update(
            kind="web", preferred_editor="web", web_document=metadata, web_revision=0
        )
        self.repository.save(project)
        workspace = WebWorkspace(self.repository, project["id"])
        workspace.save(
            {p: encode(p, v.encode()) for p, v in files.items()}, [], metadata, 0
        )
        return ProjectManager(self.repository).describe(
            self.repository.get(project["id"])
        )

    def load(self, project_id):
        return WebWorkspace(self.repository, project_id).load()

    def save(self, project_id, payload):
        return WebWorkspace(self.repository, project_id).save(
            payload.get("files", {}),
            payload.get("deleted", []),
            payload["metadata"],
            payload["revision"],
            payload.get("expected_deleted"),
        )

    def import_path(self, path, name=None):
        source = Path(path).expanduser()
        raw = (
            {source.name: source.read_bytes()}
            if not source.is_symlink()
            and source.is_file()
            and source.stat().st_size <= 4_000_000
            and source.suffix.lower() in {".html", ".htm"}
            else snapshot(source)
        )
        validate_files({p: encode(p, data) for p, data in raw.items()})
        pages = [p for p in raw if p.lower().endswith((".html", ".htm"))]
        if not pages:
            raise ValueError("Nenhuma página HTML foi encontrada.")
        metadata = (
            json.loads(raw["agata-web.json"])
            if "agata-web.json" in raw
            else {
                "version": 1,
                "entry": "index.html" if "index.html" in pages else pages[0],
                "settings": {"autosave": True, "allowHttps": False},
                "components": {},
                "tokens": {},
                "folders": [],
            }
        )
        if (
            not isinstance(metadata, dict)
            or metadata.get("version") != 1
            or safe_path(metadata.get("entry", "")) not in pages
        ):
            raise ValueError("Manifesto Web inválido.")
        from ..domain.metadata import validate_metadata

        validate_metadata(metadata)
        metadata.setdefault("settings", {})["allowHttps"] = False
        project = ProjectService(self.repository).create_project(
            {
                "name": name or source.stem,
                "platform": "web",
                "width": 1440,
                "height": 900,
            }
        )
        project.update(
            kind="web", preferred_editor="web", web_document=metadata, web_revision=0
        )
        self.repository.save(project)
        workspace = WebWorkspace(self.repository, project["id"])
        backup = workspace.base / "web-original"
        for p, data in raw.items():
            target = backup / safe_path(p)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        workspace.save(
            {p: encode(p, data) for p, data in raw.items() if p != "agata-web.json"},
            [],
            metadata,
            0,
        )
        return ProjectManager(self.repository).describe(
            self.repository.get(project["id"])
        )

    def export(self, project_id, root=None):
        workspace = WebWorkspace(self.repository, project_id)
        files = workspace.snapshot()
        destination = Path(root) if root else Path.home() / "Agata" / "Exports"
        destination.mkdir(parents=True, exist_ok=True)
        path = destination / ("web-" + uuid4().hex[:12] + ".zip")
        with ZipFile(path, "x", ZIP_DEFLATED) as archive:
            for name, entry in files.items():
                from ..domain.files import decode

                archive.writestr("AgataWeb/" + safe_path(name), decode(entry))
            archive.writestr(
                "AgataWeb/agata-web.json",
                json.dumps(
                    workspace.project["web_document"], ensure_ascii=False, indent=2
                ),
            )
        return {"ok": True, "path": str(path), "file_count": len(files) + 1}

    def catalog(self):
        return {
            "templates": catalog("web"),
            "blocks": block_catalog(),
            "blockResources": {
                "css": css_tokens(tokens())
                + BASE_CSS
                + LAYOUT_CSS
                + COMPONENTS_CSS
                + RESPONSIVE_CSS,
                "js": INTERACTIONS_JS,
            },
        }
