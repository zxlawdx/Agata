"""Composition root do Agata; registra módulos no runtime nativo do Vela."""
import sys

from config import settings
from config.bridge import AgataBridge
from vela.cli.collectstatic import collect_static
from vela.core.app import VelaApp

INSTALLED_APPS = ["apps.home", "apps.workspace", "apps.sketch_editor"]


def run():
    if not getattr(sys, "frozen", False):
        report = collect_static(
            output_dir=settings.STATIC_ROOT,
            skip_tailwind=True,
            asset_config={"tailwind": False},
            allow_install=False,
            verbose=False,
        )
        if report["errors"]:
            raise RuntimeError("Não foi possível carregar os recursos estáticos do Agata.")
    app = VelaApp(settings_module="config.settings", bridge_class=AgataBridge)
    for module in INSTALLED_APPS:
        app.register_app(module)
    app.run()
