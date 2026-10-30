"""Renderiza o editor usando os parâmetros seguros da navegação Vela."""
from vela.template_engine import render_template


def editor_view(params: dict) -> str:
    return render_template(
        "apps/sketch_editor/templates/editor.html",
        context={"project_id": str(params.get("project_id") or "")},
        router=params["router"],
    )
