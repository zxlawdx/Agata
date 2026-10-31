import json
import tempfile
import unittest
import urllib.request
from pathlib import Path
from zipfile import ZipFile
from apps.workspace.repositories.json_repository import JsonProjectRepository
from apps.web_studio.services.projects import WebProjectService
from apps.web_studio.services.storage import WebWorkspace
from apps.web_studio.services.preview import PreviewRuntime
from apps.web_studio.domain.files import encode, safe_path
from apps.template_registry.registry import WEB


class WebStudioTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.repo = JsonProjectRepository(self.root / "projects", self.root / "legacy")
        self.service = WebProjectService(self.repo)

    def tearDown(self):
        self.temp.cleanup()

    def test_all_templates_round_trip_preserve_modular_source(self):
        for key, _, _ in WEB:
            with self.subTest(template=key):
                p = self.service.create("Template " + key, key)
                self.assertEqual(p["open_editor"], "web")
                initial = self.service.load(p["id"])
                self.assertIn("js/modules/interactions.js", initial["files"])
                source = initial["files"]["index.html"]
                changed = source["content"].replace(
                    "</main>", "<!-- original comment retained --></main>"
                )
                self.service.save(
                    p["id"],
                    {
                        "files": {
                            "index.html": {
                                **encode("index.html", changed.encode()),
                                "expected_sha256": source["sha256"],
                            }
                        },
                        "deleted": [],
                        "metadata": p["web_document"],
                        "revision": initial["revision"],
                    },
                )
                exported = self.service.export(p["id"], self.root / "export")
                reimport = self.service.import_path(exported["path"])
                reopened = self.service.load(reimport["id"])
                expected = self.service.load(p["id"])
                self.assertEqual(
                    {k: v["content"] for k, v in expected["files"].items()},
                    {k: v["content"] for k, v in reopened["files"].items()},
                )

    def test_file_conflicts_backups_and_recovery(self):
        p = self.service.create("Storage")
        w = WebWorkspace(self.repo, p["id"])
        loaded = w.load()
        entry = loaded["files"]["index.html"]
        payload = {
            "files": {
                "index.html": {
                    **encode("index.html", b"<!doctype html><p>Changed</p>"),
                    "expected_sha256": entry["sha256"],
                }
            },
            "deleted": [],
            "metadata": p["web_document"],
            "revision": loaded["revision"],
        }
        w.save_recovery(payload)
        self.assertEqual(w.recovery()["revision"], loaded["revision"])
        self.service.save(p["id"], payload)
        self.assertIsNone(w.recovery())
        self.assertTrue(list((w.base / "web-history").glob("*/index.html")))
        with self.assertRaisesRegex(ValueError, "Conflito"):
            self.service.save(p["id"], payload)
        fresh = w.load()
        fresh["revision"] = self.repo.get(p["id"])["web_revision"]
        payload["revision"] = fresh["revision"]
        w.path("index.html").write_text("External editor")
        with self.assertRaisesRegex(ValueError, "externo"):
            self.service.save(p["id"], payload)

    def test_path_and_zip_slip_rejected(self):
        for name in [
            "../x",
            "/tmp/x",
            "a/../b",
            "a\\b",
            "C:x",
            ".env",
            "a//b",
            "a/./b",
        ]:
            with self.subTest(name=name), self.assertRaises(ValueError):
                safe_path(name)
        archive = self.root / "bad.zip"
        with ZipFile(archive, "w") as z:
            z.writestr("../index.html", "<p>Bad</p>")
        with self.assertRaises(ValueError):
            self.service.import_path(archive)

    def test_preview_serves_modules_on_isolated_origin_with_csp(self):
        runtime = PreviewRuntime()
        try:
            snapshot = runtime.prepare(
                {
                    "index.html": encode(
                        "index.html",
                        b'<!doctype html><html><head></head><body><script type="module" src="js/main.js"></script></body></html>',
                    ),
                    "js/main.js": encode("js/main.js", b'console.log("module")'),
                }
            )
            with urllib.request.urlopen(snapshot["url"]) as response:
                self.assertIn(
                    "default-src 'none'", response.headers["Content-Security-Policy"]
                )
                self.assertNotIn(
                    "unsafe-eval", response.headers["Content-Security-Policy"]
                )
                self.assertIn("agataPreview", response.read().decode())
            with urllib.request.urlopen(
                snapshot["url"].replace("index.html", "js/main.js")
            ) as response:
                self.assertEqual(response.read(), b'console.log("module")')
            for suffix in ["../project.json", "fixture/api/list_projects"]:
                with self.assertRaises(urllib.error.HTTPError):
                    urllib.request.urlopen(
                        snapshot["url"].replace("index.html", suffix)
                    )
        finally:
            if runtime.server:
                runtime.server.shutdown()
                runtime.server.server_close()
