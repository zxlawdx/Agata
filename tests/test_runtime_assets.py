"""Integration check of Vela collection with no Node/npm or network available."""
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


@unittest.skipUnless(importlib.util.find_spec('vela'), 'Vela is required for runtime integration')
class RuntimeAssetTests(unittest.TestCase):
    def test_collect_offline_without_frontend_tools(self):
        from vela.cli.collectstatic import collect_static
        from vela.static import StaticResolver
        from apps.sketch_editor.services.vendor import FABRIC_SHA256
        from hashlib import sha256
        with tempfile.TemporaryDirectory() as folder:
            with patch.dict('os.environ', {'PATH': ''}), patch('subprocess.run', side_effect=AssertionError('External tool invoked')), patch('socket.create_connection', side_effect=AssertionError('Network invoked')):
                report=collect_static(output_dir=folder, skip_tailwind=True,
                    asset_config={'tailwind':False},allow_install=False,verbose=False)
            self.assertEqual(report['errors'],0)
            resolver=StaticResolver.for_project(collected_root=folder)
            asset=resolver.resolve_collected('sketch_editor/vendor/fabric.js')
            self.assertEqual(sha256(asset.read_bytes()).hexdigest(),FABRIC_SHA256)
            self.assertTrue(resolver.resolve_collected('home/img/agata-smile.svg').is_file())
            self.assertTrue(resolver.resolve_collected('android_designer/vendor/codemirror.js').is_file())

    def test_runapp_startup_collects_without_node_and_registers_designer(self):
        from config.wsgi import run
        with patch('config.wsgi.VelaApp') as app, patch.dict('os.environ',{'PATH':''}), patch('subprocess.run',side_effect=AssertionError('Frontend tool invoked')):
            run()
            registered=[call.args[0] for call in app.return_value.register_app.call_args_list]
            self.assertIn('apps.android_designer',registered)
            app.return_value.run.assert_called_once()
