"""Verify the committed Fabric distribution without network or frontend tools."""
from hashlib import sha256
from pathlib import Path

VENDOR_ROOT = Path(__file__).resolve().parents[1] / 'static' / 'vendor'
FABRIC_VERSION = '5.3.0'
FABRIC_SHA256 = '48f8f0915beb512fc7fe1b48c0eeb075dd0803c790efdfd75cd007f9c3eea2ca'
LICENSE_SHA256 = 'd8f93c5639b2d11680911dff6e91567af4c44dd79a87f8ff2e85d1c8b91f9702'


def verify_vendor(root: Path = VENDOR_ROOT) -> None:
    for name, expected in [('fabric.js', FABRIC_SHA256), ('FABRIC-LICENSE.txt', LICENSE_SHA256)]:
        path = root / name
        data = path.read_bytes() if path.is_file() else b''
        # Accept only the canonical license with Windows line endings normalized.
        # This exact CRLF transformation reproduces the reported Windows hash.
        if name == 'FABRIC-LICENSE.txt':
            data = data.replace(b'\r\n', b'\n')
        if sha256(data).hexdigest() != expected:
            raise RuntimeError(f'Recurso local ausente ou alterado: {name}. Restaure os arquivos da distribuição Agata.')
