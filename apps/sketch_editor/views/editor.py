"""Rota do editor e versão dos assets servidos pela WebView do Vela."""
from vela.template_engine import render_template

from apps.sketch_editor.services.asset_version import asset_revision


def editor_view(params: dict) -> str:
    return render_template(
        "apps/sketch_editor/templates/editor.html",
        context={
            "project_id": str(params.get("project_id") or ""),
            "assets_version": asset_revision(),
        },
        router=params["router"],
    )
