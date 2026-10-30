"""Carimbo de versão impede JS/CSS antigo persistido na WebView."""
import tempfile
import unittest
from pathlib import Path

from apps.sketch_editor.services.asset_version import asset_revision


class AssetRevisionTests(unittest.TestCase):
    def test_muda_quando_codigo_muda(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            asset = root / "static" / "js" / "editor.js"
            asset.parent.mkdir(parents=True)
            asset.write_text("primeira revisão", encoding="utf-8")
            first = asset_revision(root)
            self.assertEqual(first, asset_revision(root))
            asset.write_text("segunda revisão", encoding="utf-8")
            self.assertNotEqual(first, asset_revision(root))

    def test_template_expoe_versao_e_aplica_em_todos_os_assets(self):
        template = (Path(__file__).resolve().parents[1]
                    / "apps/sketch_editor/templates/editor.html").read_text(encoding="utf-8")
        self.assertIn("Editor rev {{ assets_version }}", template)
        self.assertIn("editor.css') }}?v={{ assets_version }}", template)
        for name in ("fabric.js", "sketch_core.js", "components.js",
                     "component_edit.js", "element_tree.js", "editor.js"):
            self.assertIn(name + "') }}?v={{ assets_version }}", template)
