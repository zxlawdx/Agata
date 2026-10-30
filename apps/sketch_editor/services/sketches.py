"""Regras de salvamento de esboços, independentes do Fabric e da WebView."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone

from apps.workspace.repositories.base import ProjectRepository

_LAYER_ID = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")
_MAX_LAYERS = 80
_MAX_OBJECTS = 8000
_MAX_BYTES = 8 * 1024 * 1024


class SketchService:
    def __init__(self, repository: ProjectRepository):
        self.repository = repository

    def save(self, project_id: str, payload: dict) -> dict:
        if not isinstance(payload, dict):
            raise ValueError("Esboço inválido.")
        try:
            encoded = json.dumps(payload, ensure_ascii=False, allow_nan=False)
        except (ValueError, TypeError, OverflowError, RecursionError) as exc:
            raise ValueError("O desenho não pode ser serializado.") from exc
        if len(encoded.encode("utf-8")) > _MAX_BYTES:
            raise ValueError("O projeto excede o limite de 8 MB por tela.")

        layers = payload.get("layers")
        active_id = payload.get("active_layer_id")
        if not isinstance(layers, list) or not 1 <= len(layers) <= _MAX_LAYERS:
            raise ValueError("O desenho deve possuir de 1 a 80 camadas.")
        ids: set[str] = set()
        total_objects = 0
        clean_layers = []
        for layer in layers:
            if not isinstance(layer, dict):
                raise ValueError("Camada inválida.")
            layer_id = layer.get("id")
            name = layer.get("name")
            visible, locked = layer.get("visible"), layer.get("locked")
            objects = layer.get("objects")
            if (not isinstance(layer_id, str) or not _LAYER_ID.fullmatch(layer_id)
                    or layer_id in ids):
                raise ValueError("ID de camada inválido ou repetido.")
            if not isinstance(name, str) or not 1 <= len(name.strip()) <= 60:
                raise ValueError("Nome de camada inválido.")
            if any(ord(ch) < 32 for ch in name):
                raise ValueError("Nome de camada contém caracteres de controle.")
            if type(visible) is not bool or type(locked) is not bool:
                raise ValueError("Visibilidade ou bloqueio de camada inválidos.")
            if not isinstance(objects, list) or not all(isinstance(obj, dict) for obj in objects):
                raise ValueError("Objetos da camada devem ser registros JSON.")
            total_objects += len(objects)
            if total_objects > _MAX_OBJECTS:
                raise ValueError("O projeto excede 8000 objetos.")
            ids.add(layer_id)
            clean_layers.append({
                "id": layer_id, "name": name.strip(), "visible": visible,
                "locked": locked, "objects": objects,
            })
        if active_id not in ids:
            raise ValueError("A camada ativa não existe.")

        project = self.repository.get(project_id)
        if project.get("kind") != "sketch" or not project.get("screens"):
            raise ValueError("O projeto não é um esboço compatível.")
        project["screens"][0]["layers"] = clean_layers
        project["screens"][0]["active_layer_id"] = active_id
        project["updated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        self.repository.save(project)
        return {"ok": True, "updated_at": project["updated_at"]}
