import unittest
from apps.design_system.services.android import (
    template_document,
    component,
    resolve_tokens,
    COMPONENTS,
)
from apps.design_system.services.tokens import tokens
from apps.template_registry.registry import ANDROID
from apps.android_designer.domain.model import (
    new_document,
    validate,
    walk,
    resolve_layout,
)
from apps.android_designer.exporters.project import generate


class DesignSystemTests(unittest.TestCase):
    def test_all_premium_templates_are_real_editable_trees_and_export(self):
        for key, _, _ in ANDROID:
            with self.subTest(template=key):
                document = template_document(key)
                self.assertEqual(len(document["screens"]), 2)
                self.assertTrue(
                    any(
                        n["events"].get("onClick", {}).get("action") == "navigate"
                        for s in document["screens"]
                        for n in walk(s["root"])
                    )
                )
                files = generate(document, "compose")
                self.assertIn("agata-model.json", files)
                import tree_sitter, tree_sitter_kotlin

                parser = tree_sitter.Parser(
                    tree_sitter.Language(tree_sitter_kotlin.language())
                )
                for path, content in files.items():
                    if path.endswith(".kt"):
                        self.assertFalse(
                            parser.parse(content.encode()).root_node.has_error, path
                        )
                self.assertTrue(any(path.endswith("/AgataTokens.kt") for path in files))
                kotlin = "\n".join(v for p, v in files.items() if p.endswith(".kt"))
                self.assertIn("1600.dp", kotlin)
                self.assertIn("1200.dp", kotlin)
                self.assertFalse(
                    __import__("json").loads(files["agata-export-diagnostics.json"])[
                        "android_build_verified"
                    ]
                )

    def test_premium_component_contract(self):
        for name in COMPONENTS:
            with self.subTest(component=name):
                d = new_document()
                d["screens"][0]["root"]["children"] = [component(name, tokens())]
                validate(d)
                generate(d, "compose")

    def test_token_overrides_propagate_and_component_override_detaches(self):
        d = template_document("music-dark")
        n = next(
            n
            for n in walk(d["screens"][0]["root"])
            if n.get("tokenReferences", {}).get("props.color") == "colors.textPrimary"
        )
        node_id = n["id"]
        changed = resolve_tokens(d, {"colors": {"textPrimary": "#FF00FF"}})
        node = next(
            n for n in walk(changed["screens"][0]["root"]) if n["id"] == node_id
        )
        self.assertEqual(node["props"]["color"], "#FF00FF")
        node["tokenOverrides"] = ["props.color"]
        node["props"]["color"] = "#112233"
        again = resolve_tokens(changed, {"colors": {"textPrimary": "#FFFFFF"}})
        self.assertEqual(
            next(n for n in walk(again["screens"][0]["root"]) if n["id"] == node_id)[
                "props"
            ]["color"],
            "#112233",
        )

    def test_official_width_classes_and_legacy_expanded_fallback(self):
        layout = template_document("music-dark")["screens"][0]["root"]["layout"]
        self.assertEqual(
            [
                resolve_layout(layout, w, 2000)["padding"]
                for w in [599, 600, 839, 840, 1199, 1200, 1599, 1600]
            ],
            [16, 32, 32, 48, 48, 64, 64, 80],
        )
        layout["responsive"] = {"expanded": {"padding": 31}}
        self.assertEqual(resolve_layout(layout, 1800, 2000)["padding"], 31)
