"""Validate persisted domain metadata independently of transport and renderer."""

import json
from .files import safe_path


def validate_metadata(value):
    if (
        not isinstance(value, dict)
        or len(json.dumps(value, allow_nan=False).encode()) > 4_000_000
    ):
        raise ValueError("Metadados Web inválidos.")
    if value.get("version") != 1:
        raise ValueError("Versão Web não suportada.")
    entry = safe_path(value.get("entry", ""))
    if not entry.lower().endswith((".html", ".htm")):
        raise ValueError("Entrada deve ser HTML.")
    folders = value.get("folders", [])
    if not isinstance(folders, list) or len(folders) > 1000:
        raise ValueError("Pastas inválidas.")
    for folder in folders:
        safe_path(folder)
    settings = value.get("settings", {})
    if not isinstance(settings, dict):
        raise ValueError("Configurações Web inválidas.")
    for key in ["autosave", "allowHttps", "reducedMotion"]:
        if key in settings and type(settings[key]) is not bool:
            raise ValueError("Configuração booleana inválida: " + key)
    if "autosaveInterval" in settings and (
        type(settings["autosaveInterval"]) is not int
        or not 5 <= settings["autosaveInterval"] <= 300
    ):
        raise ValueError("Intervalo autosave deve ser entre 5 e 300 segundos.")
    for key in ["tokens", "components"]:
        if key in value and not isinstance(value[key], dict):
            raise ValueError("Metadados inválidos: " + key)
    return value
