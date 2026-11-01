"""Verify the exact offline editor distribution and its license inventory."""

from pathlib import Path
from hashlib import sha256
import json

ROOT = Path(__file__).resolve().parents[1] / "static/vendor"


def verify_vendor(root=ROOT):
    notice = json.loads((root / "NOTICE.json").read_text(encoding="utf-8"))
    for name, expected in notice["files"].items():
        path = root / name
        if (
            not path.is_file()
            or sha256(path.read_bytes()).hexdigest() != expected["sha256"]
        ):
            raise RuntimeError("Recurso Web ausente ou modificado: " + name)
    for package in notice["packages"]:
        if (
            not package.get("license_file")
            or not (root / package["license_file"]).is_file()
        ):
            raise RuntimeError("Licença Web ausente: " + package["name"])
    return notice
