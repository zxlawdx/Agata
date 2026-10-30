"""Composition root do Yara; integra apps e Bridge no Vela."""
import sys

from config import settings
from config.bridge import YaraBridge
from vela.cli.collectstatic import collect_static
from vela.core.app import VelaApp

INSTALLED_APPS = ["apps.home", "apps.workspace"]


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
            raise RuntimeError("Não foi possível carregar os recursos estáticos do Yara.")
    app = VelaApp(settings_module="config.settings", bridge_class=YaraBridge)
    for module in INSTALLED_APPS:
        app.register_app(module)
    app.run()
