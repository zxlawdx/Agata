"""Workspace-independent file validation and stable content versions."""

from pathlib import PurePosixPath
import base64, hashlib, re

MAX_TEXT = 4_000_000
MAX_TOTAL = 60_000_000
MAX_FILES = 1500


def safe_path(value):
    if (
        not isinstance(value, str)
        or not value
        or len(value) > 240
        or "\\" in value
        or "\x00" in value
        or ":" in value
        or value.startswith("/")
        or re.search(r"[\x00-\x1f]", value)
    ):
        raise ValueError("Caminho Web inválido.")
    parts = PurePosixPath(value).parts
    if (
        any(p in {".", ".."} or p.startswith(".") for p in parts)
        or str(PurePosixPath(value)) != value
    ):
        raise ValueError("Caminho Web fora do workspace.")
    return value


def digest(data):
    return hashlib.sha256(data).hexdigest()


def decode(entry):
    if (
        not isinstance(entry, dict)
        or entry.get("encoding") not in {"utf8", "base64"}
        or not isinstance(entry.get("content"), str)
    ):
        raise ValueError("Arquivo Web inválido.")
    if len(entry["content"]) > 8_000_000:
        raise ValueError("Arquivo Web excede o limite.")
    try:
        data = (
            entry["content"].encode("utf-8")
            if entry["encoding"] == "utf8"
            else base64.b64decode(entry["content"], validate=True)
        )
    except (ValueError, UnicodeError) as exc:
        raise ValueError("Conteúdo de arquivo inválido.") from exc
    if entry["encoding"] == "utf8" and len(data) > MAX_TEXT or len(data) > 6_000_000:
        raise ValueError("Arquivo grande demais.")
    return data


def encode(path, data):
    safe_path(path)
    try:
        content = data.decode("utf-8")
        encoding = "utf8"
    except UnicodeDecodeError:
        content = base64.b64encode(data).decode()
        encoding = "base64"
    return {
        "path": path,
        "encoding": encoding,
        "content": content,
        "sha256": digest(data),
    }


def validate_files(files):
    if not isinstance(files, dict) or len(files) > MAX_FILES:
        raise ValueError("Limite de arquivos Web excedido.")
    total = 0
    seen = set()
    result = {}
    for path, entry in files.items():
        safe_path(path)
        if path.casefold() in seen:
            raise ValueError(
                "Caminhos duplicados para sistemas sem distinção de caixa."
            )
        seen.add(path.casefold())
        data = decode(entry)
        total += len(data)
        if total > MAX_TOTAL:
            raise ValueError("Projeto Web excede 60 MB.")
        result[path] = data
    return result
