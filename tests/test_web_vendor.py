import json
import tempfile
import unittest
from pathlib import Path
from apps.web_studio.services.vendor import verify_vendor, ROOT


class WebVendorTests(unittest.TestCase):
    def test_all_offline_bundles_workers_and_licenses_verified(self):
        notice = verify_vendor()
        self.assertLess(notice["total_bytes"], 17_000_000)
        self.assertTrue(all(p["license_file"] for p in notice["packages"]))
        self.assertIn("workers/typescript.js", notice["files"])
        bundle=(ROOT/"monaco.js").read_text()
        self.assertIn("DOMPurify 3.4.17",bundle)
        self.assertNotIn("DOMPurify 3.4.15",bundle)
        catalog = json.loads((ROOT.parent / "model/html-elements.json").read_text())
        elements = {e["name"]: e for e in catalog["elements"]}
        for name in [
            "search",
            "dialog",
            "template",
            "svg",
            "math",
            "slot",
            "canvas",
            "table",
            "input",
        ]:
            self.assertIn(name, elements)
        self.assertFalse(elements["head"]["visual"])
        self.assertTrue(elements["font"]["deprecated"])

    def test_corrupt_distribution_refuses_startup(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "NOTICE.json").write_text(
                json.dumps(
                    {"files": {"missing.js": {"sha256": "none"}}, "packages": []}
                )
            )
            with self.assertRaisesRegex(RuntimeError, "missing.js"):
                verify_vendor(root)
