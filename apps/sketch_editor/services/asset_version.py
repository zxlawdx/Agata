"""Carimbo de versão baseado no conteúdo dos assets locais do editor."""
from hashlib import sha256
from pathlib import Path


def asset_revision(root: Path | None = None) -> str:
    """Hash de fontes do editor para invalidar caches após cada atualização."""
    root = root or Path(__file__).resolve().parents[1]
    checksum = sha256()
    for relative in (
        "templates/editor.html",
        "static/editor.css",
        "static/vendor/fabric.js",
        "static/js/sketch_core.js",
        "static/js/components.js",
        "static/js/component_edit.js",
        "static/js/element_tree.js",
        "static/js/editor.js",
    ):
        target = root / relative
        if not target.is_file():
            continue
        checksum.update(relative.encode("utf-8"))
        checksum.update(target.read_bytes())
    return checksum.hexdigest()[:12]
