import tempfile
import unittest
from pathlib import Path
from apps.sketch_editor.services.vendor import verify_vendor, VENDOR_ROOT


class VendorTests(unittest.TestCase):
    def test_offline_distribution(self):
        verify_vendor()
        self.assertIn('version:"5.3.0"', (VENDOR_ROOT/'fabric.js').read_text())

    def test_modified_asset_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root/'fabric.js').write_text('altered')
            with self.assertRaisesRegex(RuntimeError, 'fabric.js'):
                verify_vendor(root)
