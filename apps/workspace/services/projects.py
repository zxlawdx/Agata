"""Casos de uso: validação, criação e consulta de projetos."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from uuid import uuid4

from apps.workspace.repositories.base import ProjectRepository

_PLATFORMS = {"android", "web", "desktop"}
_CONTROL = re.compile(r"[\x00-\x1f\x7f]")


class ProjectService:
    def __init__(self, repository: ProjectRepository):
        self.repository = repository

    def create_project(self, payload: dict) -> dict:
        if not isinstance(payload, dict):
            raise ValueError("Dados inválidos.")
        name = payload.get("name")
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80:
            raise ValueError("Informe um nome com até 80 caracteres.")
        name = name.strip()
        if _CONTROL.search(name):
            raise ValueError("O nome contém caracteres inválidos.")

        platform = payload.get("platform", "android")
        if platform not in _PLATFORMS:
            raise ValueError("Plataforma inválida.")

        width, height = payload.get("width", 390), payload.get("height", 844)
        if type(width) is not int or type(height) is not int:
            raise ValueError("Largura e altura devem ser inteiros.")
        if not (240 <= width <= 4096 and 240 <= height <= 4096):
            raise ValueError("Dimensões devem estar entre 240 e 4096 pixels.")

        stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
        project = {
            "schema_version": 1,
            "id": uuid4().hex,
            "name": name,
            "kind": "sketch",
            "platform": platform,
            "canvas": {"width": width, "height": height},
            "screens": [{"id": uuid4().hex, "name": "Tela 1", "elements": []}],
            "created_at": stamp,
            "updated_at": stamp,
        }
        self.repository.save(project)
        return project

    def get_project(self, project_id: str) -> dict:
        return self.repository.get(project_id)

    def list_projects(self) -> list[dict]:
        return self.repository.list()
