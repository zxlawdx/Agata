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

    def test_windows_crlf_license_matches_canonical_bytes(self):
        import shutil
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            for name in ['fabric.js','FABRIC-LICENSE.txt']:shutil.copyfile(VENDOR_ROOT/name,root/name)
            license_file=root/'FABRIC-LICENSE.txt'
            license_file.write_bytes(license_file.read_bytes().replace(b'\n',b'\r\n'))
            verify_vendor(root)
            license_file.write_bytes(license_file.read_bytes()+b'changed')
            with self.assertRaisesRegex(RuntimeError,'FABRIC-LICENSE'):
                verify_vendor(root)
