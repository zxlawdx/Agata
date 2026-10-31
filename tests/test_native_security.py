import unittest
from types import SimpleNamespace
from unittest.mock import Mock
from config.bridge import AgataBridge
from config.native_security import guarded_dispatcher, SESSION_TOKEN, bootstrap_script
from config.http_server import NativeBootstrapPlugin


class NativeTransportSecurityTests(unittest.TestCase):
    def setUp(self):
        self.original = Mock(return_value="dispatched")
        self.guard = guarded_dispatcher(self.original)
        self.window = SimpleNamespace(_js_api=AgataBridge.__new__(AgataBridge))

    def test_raw_engine_channel_cannot_bypass_opaque_iframe(self):
        for payload in [
            [],
            {},
            {"agataTransport": 1, "capability": "forged", "params": []},
            "not JSON",
        ]:
            self.assertFalse(self.guard(self.window, "list_projects", payload, "id"))
        self.original.assert_not_called()

    def test_private_and_nested_python_attributes_are_never_dispatchable(self):
        payload = {"agataTransport": 1, "capability": SESSION_TOKEN, "params": []}
        for name in [
            "router.resolve",
            "get_config.__globals__.update",
            "_attach_window",
            "__class__",
            "not_an_api",
        ]:
            self.assertFalse(self.guard(self.window, name, payload, "id"))
        self.original.assert_not_called()

    def test_trusted_shell_preserves_existing_api_parameters_and_native_callbacks(self):
        payload = {
            "agataTransport": 1,
            "capability": SESSION_TOKEN,
            "params": ["name", "template"],
        }
        self.assertEqual(
            self.guard(self.window, "create_web_project", payload, "id"), "dispatched"
        )
        self.original.assert_called_with(
            self.window, "create_web_project", ["name", "template"], "id"
        )
        payload["params"] = '{"ok":true}'
        self.guard(self.window, "pywebviewAsyncCallback", payload, "native-id")
        self.original.assert_called_with(
            self.window, "pywebviewAsyncCallback", '{"ok":true}', "native-id"
        )

    def test_capability_is_only_bootstrapped_in_framework_shell(self):
        plugin = NativeBootstrapPlugin()
        callback = (
            lambda: "<html><head><script>window.shell=true</script></head></html>"
        )
        self.assertIs(
            plugin.apply(callback, SimpleNamespace(rule="/project/index.html")),
            callback,
        )
        content = plugin.apply(callback, SimpleNamespace(rule="/__vela__/shell"))()
        self.assertLess(
            content.index("_agataTransportGuard"), content.index("window.shell=true")
        )
        self.assertIn("window.top!==window", content)
