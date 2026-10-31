"""Exportador local: sem diálogo de navegador nem dependência de rede."""
from __future__ import annotations

import base64
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree

from apps.workspace.repositories.base import ProjectRepository


class ArtworkExporter:
    def __init__(self, repository: ProjectRepository, root: Path | None = None):
        self.repository = repository
        self.root = root or Path.home() / "Agata" / "Exports"

    def export(self, project_id: str, file_format: str, data: str = "") -> dict:
        if file_format not in {"svg", "png", "json"}:
            raise ValueError("Formato de exportação inválido.")
        project = self.repository.get(project_id)
        if project.get("kind") != "sketch":
            raise ValueError("Projeto não compatível para exportação.")
        if file_format == "json":
            payload = (json.dumps(project, indent=2, ensure_ascii=False)+"\n").encode("utf-8")
        elif file_format == "svg":
            if not isinstance(data, str) or len(data.encode("utf-8")) > 8_000_000:
                raise ValueError("SVG vazio ou muito grande.")
            if re.search(r"<!DOCTYPE|<!ENTITY|<script\b|onload\s*=|javascript:", data, re.IGNORECASE):
                raise ValueError("Conteúdo SVG não permitido.")
            try:
                node = ElementTree.fromstring(data)
            except ElementTree.ParseError as exc:
                raise ValueError("SVG inválido.") from exc
            if node.tag.split("}")[-1].lower() != "svg":
                raise ValueError("O conteúdo não é um SVG.")
            payload = data.encode("utf-8")
        else:
            if not isinstance(data, str) or not data.startswith("data:image/png;base64,"):
                raise ValueError("Imagem PNG inválida.")
            try:
                payload = base64.b64decode(data.partition(",")[2], validate=True)
            except (ValueError, base64.binascii.Error) as exc:
                raise ValueError("Imagem PNG inválida.") from exc
            if len(payload)>8_000_000 or not payload.startswith(b"\x89PNG\r\n\x1a\n"):
                raise ValueError("PNG excedeu o limite ou é inválido.")
        if len(payload) > 8_000_000:
            raise ValueError("O arquivo excede o limite de 8 MB.")
        self.root.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
        target = self.root / f"{project_id[:12]}-{stamp}.{file_format}"
        with target.open("xb") as handle:
            handle.write(payload)
        return {"ok": True, "path": str(target), "format": file_format}
