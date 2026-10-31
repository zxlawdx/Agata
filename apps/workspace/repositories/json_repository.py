"""Persistência local com IDs seguros e escrita atômica."""
from __future__ import annotations

import json
import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)
_VALID_ID = re.compile(r"^[0-9a-f]{32}$")


class JsonProjectRepository:
    def __init__(self, root: Path, legacy_root: Path | None = None):
        self.root = Path(root)
        self.legacy_root = Path(legacy_root) if legacy_root is not None else None

    def _read_path(self, project_id: str) -> Path:
        self._path(project_id)
        entry=self._registry().get(project_id)
        if entry:return Path(entry['path'])
        current = self._path(project_id)
        if current.is_file() or self.legacy_root is None:
            return current
        legacy = self.legacy_root / project_id / "project.json"
        return legacy if legacy.is_file() else current

    def _registry(self):
        path=self.root/'project-registry.json'
        if not path.exists():return {}
        try:
            value=json.loads(path.read_text(encoding='utf-8'))
            return value if isinstance(value,dict) else {}
        except (ValueError,OSError):return {}

    def _save_registry(self,value):
        self.root.mkdir(parents=True,exist_ok=True);path=self.root/'project-registry.json';temporary=path.with_suffix('.tmp');temporary.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8');temporary.replace(path)

    def register(self,project_id,path,name):
        self._path(project_id)
        from datetime import datetime,timezone
        index=self._registry();index[project_id]={'path':str(Path(path).absolute()),'name':name,'opened_at':datetime.now(timezone.utc).isoformat(),'hidden':False};self._save_registry(index)

    def save_at(self,project,path):
        path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
        if path.exists():raise ValueError('Projeto existente não será sobrescrito.')
        path.write_text(json.dumps(project,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');self.register(project['id'],path,project['name'])

    def _path(self, project_id: str) -> Path:
        if not isinstance(project_id, str) or not _VALID_ID.fullmatch(project_id):
            raise ValueError("Identificador de projeto inválido.")
        return self.root / project_id / "project.json"

    def save(self, project: dict) -> None:
        path = self._read_path(project["id"])
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(".tmp")
        temporary.write_text(
            json.dumps(project, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary.replace(path)

    def get(self, project_id: str) -> dict:
        path = self._read_path(project_id)
        if not path.is_file():
            raise FileNotFoundError("Projeto não encontrado.")
        document = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(document, dict) or document.get("id") != project_id:
            raise ValueError("Arquivo de projeto inválido.")
        return document

    def list(self) -> list[dict]:
        roots = [self.root]
        if self.legacy_root is not None and self.legacy_root != self.root:
            roots.append(self.legacy_root)
        projects, ids = [], set()
        for root in roots:
            if not root.is_dir():
                continue
            for path in root.glob("*/project.json"):
                project_id = path.parent.name
                if project_id in ids:
                    continue
                try:
                    projects.append(self.get(project_id))
                    ids.add(project_id)
                except (ValueError, OSError, json.JSONDecodeError):
                    logger.warning("Ignorando projeto inválido: %s", path)
        for key in self._registry():
            if key not in ids:
                try:projects.append(self.get(key));ids.add(key)
                except (ValueError,OSError,json.JSONDecodeError):pass
        return sorted(projects, key=lambda item: item.get("updated_at", ""), reverse=True)
