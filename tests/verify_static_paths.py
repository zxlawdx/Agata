"""Conferência de todos os caminhos static(...) usados nos templates do Agata.

Fabric e o mascote são distribuídos no repositório; não requer NPM.
"""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATIC_REF = re.compile(r"""static\(\s*['"]([^'"]+)['"]\s*\)""")


class StaticReferencesTests(unittest.TestCase):
    def test_template_assets_exist_in_expected_app_directories(self):
        refs = []
        for template in (ROOT / "apps").glob("*/templates/**/*.html"):
            content = template.read_text(encoding="utf-8")
            for reference in STATIC_REF.findall(content):
                refs.append((template, reference))
                pieces = Path(reference).parts
                self.assertGreaterEqual(len(pieces), 2, f"{template}: {reference}")
                app, *relative = pieces
                expected = ROOT / "apps" / app / "static" / Path(*relative)
                with self.subTest(template=template.name, static=reference):
                    self.assertTrue(expected.is_file(), f"static não encontrado: {reference} (esperado: {expected})")
        self.assertGreater(len(refs), 0, "Nenhuma referência static() foi encontrada.")
