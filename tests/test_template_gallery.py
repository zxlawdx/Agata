"""Gallery cannot claim an editable template without an actual source-backed preview."""
import unittest
from apps.template_registry.preview import gallery_catalog, preview
from apps.template_registry.registry import WEB, ANDROID


class TemplateGalleryTests(unittest.TestCase):
    def test_catalog_has_platform_and_license_information(self):
        entries = gallery_catalog()
        self.assertGreaterEqual(len(entries), 20)
        self.assertTrue(all(item["platform"] in {"android", "web"} for item in entries))
        for item in entries:
            self.assertTrue(item.get("id"))
            self.assertTrue(item.get("name"))
            self.assertTrue(item.get("license"))
            self.assertTrue(item.get("category"))
            self.assertTrue(item.get("version"))

    def test_web_previews_come_from_real_html_css_but_do_not_run_scripts(self):
        for identifier, _, _ in WEB:
            with self.subTest(template=identifier):
                data = preview(identifier, "web")
                self.assertEqual(data["kind"], "web-source")
                self.assertIn("<main", data["html"])
                self.assertIn("<style>", data["html"])
                self.assertIn("--colors-primary", data["html"])
                self.assertNotIn('<script type="module"', data["html"])
                self.assertNotIn("<agata-include", data["html"])

    def test_android_previews_derive_from_editable_document(self):
        for identifier, _, _ in ANDROID:
            with self.subTest(template=identifier):
                data = preview(identifier, "android")
                self.assertEqual(data["kind"], "android-model")
                self.assertGreater(data["screens"], 0)
                self.assertIn("node-", data["html"])
                self.assertIn("prévia esquemática", data["html"])

    def test_invalid_template_is_rejected_without_fallback(self):
        for identifier, platform in [("missing", "web"), ("premium-landing", "android")]:
            with self.assertRaises(ValueError):
                preview(identifier, platform)


if __name__ == "__main__":
    unittest.main()
