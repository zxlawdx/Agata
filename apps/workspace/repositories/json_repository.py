"""Persistência local com IDs seguros e escrita atômica."""
from __future__ import annotations

import json
import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)
_VALID_ID = re.compile(r"^[0-9a-f]{32}$")


class JsonProjectRepository:
    def __init__(self, root: Path):
        self.root = Path(root)

    def _path(self, project_id: str) -> Path:
        if not isinstance(project_id, str) or not _VALID_ID.fullmatch(project_id):
            raise ValueError("Identificador de projeto inválido.")
        return self.root / project_id / "project.json"

    def save(self, project: dict) -> None:
        path = self._path(project["id"])
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(".tmp")
        temporary.write_text(
            json.dumps(project, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary.replace(path)

    def get(self, project_id: str) -> dict:
        path = self._path(project_id)
        if not path.is_file():
            raise FileNotFoundError("Projeto não encontrado.")
        document = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(document, dict) or document.get("id") != project_id:
            raise ValueError("Arquivo de projeto inválido.")
        return document

    def list(self) -> list[dict]:
        if not self.root.exists():
            return []
        projects = []
        for path in self.root.glob("*/project.json"):
            try:
                projects.append(self.get(path.parent.name))
            except (ValueError, OSError, json.JSONDecodeError):
                logger.warning("Ignorando projeto inválido: %s", path)
        return sorted(
            projects,
            key=lambda item: item.get("updated_at", ""),
            reverse=True,
        )
