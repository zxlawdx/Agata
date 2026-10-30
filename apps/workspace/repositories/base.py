"""Contrato de persistência: domínio não depende do formato JSON."""
from __future__ import annotations

from typing import Protocol


class ProjectRepository(Protocol):
    def save(self, project: dict) -> None: ...
    def list(self) -> list[dict]: ...
    def get(self, project_id: str) -> dict: ...
