"""Real project files, atomic writes, bounded recovery and explicit backups."""

from pathlib import Path
from threading import RLock
from uuid import uuid4
from datetime import datetime, timezone
import json, shutil
from ..domain.metadata import validate_metadata
from ..domain.files import (
    safe_path,
    validate_files,
    encode,
    digest,
    MAX_TOTAL,
    MAX_FILES,
)

LOCK = RLock()


class WebWorkspace:
    def __init__(self, repository, project_id):
        self.repository = repository
        self.project = repository.get(project_id)
        if self.project.get("kind") != "web":
            raise ValueError("Este projeto não é Web.")
        self.base = repository._read_path(project_id).parent
        self.root = self.base / "web-root"

    def path(self, name):
        name = safe_path(name)
        target = self.root / name
        for p in [self.root, *target.parents]:
            if p == self.base:
                break
            if p.is_symlink():
                raise ValueError("Links simbólicos não são permitidos no workspace.")
        if target.is_symlink():
            raise ValueError("Arquivo não pode ser link simbólico.")
        if not target.resolve().is_relative_to(self.root.resolve()):
            raise ValueError("Caminho fora do workspace.")
        return target

    def snapshot(self):
        with LOCK:
            return self._snapshot()

    def _snapshot(self):
        result = {}
        total = 0
        if not self.root.exists():
            return result
        for path in sorted(self.root.rglob("*")):
            if path.is_symlink():
                raise ValueError("Workspace contém link simbólico.")
            if path.is_file():
                relative = path.relative_to(self.root).as_posix()
                data = self.path(relative).read_bytes()
                total += len(data)
                if len(result) >= MAX_FILES or total > MAX_TOTAL:
                    raise ValueError("Workspace excede os limites.")
                result[relative] = encode(relative, data)
        return result

    def load(self):
        self.project = self.repository.get(self.project["id"])
        return {
            "project": self.project,
            "files": self.snapshot(),
            "revision": self.project.get("web_revision", 0),
            "recovery": self.recovery(),
        }

    def save(self, changes, deleted, metadata, revision, expected_deleted=None):
        raw = validate_files(changes)
        if not isinstance(deleted, list) or len(deleted) > MAX_FILES:
            raise ValueError("Exclusões inválidas.")
        deleted = [safe_path(p) for p in deleted]
        if set(raw) & set(deleted):
            raise ValueError("Arquivo alterado e excluído na mesma operação.")
        validate_metadata(metadata)
        with LOCK:
            current = self.repository.get(self.project["id"])
            previous_folders = set(current.get("web_document", {}).get("folders", []))
            if type(revision) is not int or revision != current.get("web_revision", 0):
                raise ValueError(
                    "Conflito: projeto alterado em outra janela. Compare/reabra antes de salvar."
                )
            for name, entry in changes.items():
                path = self.path(name)
                actual = digest(path.read_bytes()) if path.is_file() else None
                if entry.get("expected_sha256") != actual:
                    raise ValueError("Conflito de arquivo externo: " + name)
            for name in deleted:
                path = self.path(name)
                actual = digest(path.read_bytes()) if path.is_file() else None
                if (
                    not isinstance(expected_deleted, dict)
                    or expected_deleted.get(name) != actual
                ):
                    raise ValueError("Conflito de exclusão externa: " + name)
            for deleted_file in deleted:
                previous_folders.update(
                    parent.as_posix()
                    for parent in Path(deleted_file).parents
                    if parent.as_posix() != "."
                )
            before = {
                p: self.path(p).read_bytes() if self.path(p).is_file() else None
                for p in set(raw) | set(deleted)
            }
            backup = self.base / "web-history" / uuid4().hex
            backup.mkdir(parents=True, exist_ok=True)
            (backup / "project.json").write_text(
                json.dumps(current, ensure_ascii=False), encoding="utf-8"
            )
            for p, data in before.items():
                if data is not None:
                    destination = backup / p
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    destination.write_bytes(data)
            try:
                for name, data in raw.items():
                    path = self.path(name)
                    path.parent.mkdir(parents=True, exist_ok=True)
                    temporary = path.with_name(".agata-tmp-" + uuid4().hex)
                    temporary.write_bytes(data)
                    temporary.replace(path)
                for name in deleted:
                    self.path(name).unlink(missing_ok=True)
                for folder in metadata.get("folders", []):
                    self.path(folder).mkdir(parents=True, exist_ok=True)
                current_files = (
                    self.snapshot()
                )  # Verify total project limits before committing revision.
                if metadata["entry"] not in current_files:
                    raise ValueError("Página de entrada não existe.")
                current["web_document"] = metadata
                current["web_revision"] = revision + 1
                current["updated_at"] = datetime.now(timezone.utc).isoformat()
                self.repository.save(current)
            except (OSError, ValueError):
                for name, data in before.items():
                    path = self.path(name)
                    if data is None:
                        path.unlink(missing_ok=True)
                    else:
                        path.parent.mkdir(parents=True, exist_ok=True)
                        path.write_bytes(data)
                raise
            for folder in sorted(
                previous_folders - set(metadata.get("folders", [])),
                key=len,
                reverse=True,
            ):
                try:
                    self.path(folder).rmdir()
                except OSError:
                    pass
            self.project = current
            (self.base / "web-recovery.json").unlink(missing_ok=True)
            histories = (
                sorted(
                    (self.base / "web-history").glob("*"),
                    key=lambda p: p.stat().st_mtime,
                )
                if (self.base / "web-history").exists()
                else []
            )
            for old in histories[:-20]:
                shutil.rmtree(old, ignore_errors=True)
            return {
                "ok": True,
                "revision": revision + 1,
                "files": {p: digest(data) for p, data in raw.items()},
            }

    def save_recovery(self, payload):
        validate_files(payload.get("files", {}))
        if len(json.dumps(payload).encode()) > 12_000_000:
            raise ValueError("Recovery excede 12 MB; salve os arquivos.")
        path = self.base / "web-recovery.json"
        temp = path.with_suffix(".tmp")
        temp.write_text(json.dumps(payload), encoding="utf-8")
        temp.replace(path)
        return {"ok": True}

    def recovery(self):
        path = self.base / "web-recovery.json"
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            return None

    def folder(self, name):
        self.path(name).mkdir(parents=True, exist_ok=True)
        return {"ok": True}
