"""Renderização da home com o template engine do Vela."""
from config.settings import APP_TITLE, APP_VERSION
from vela.template_engine import render_template


def home_view(params: dict) -> str:
    return render_template(
        "apps/home/templates/home.html",
        {"app_title": APP_TITLE, "app_version": APP_VERSION},
        router=params["router"],
    )
