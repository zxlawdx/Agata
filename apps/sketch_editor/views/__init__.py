"""Rota do editor, sem parâmetros dinâmicos no path (API do Router do Vela)."""
from apps.sketch_editor.views.editor import editor_view


def register_routes(router):
    router.add(
        "/sketch",
        editor_view,
        name="sketch",
        title="Editor de esboços",
        layout="blank",
        show_in_sidebar=False,
        order=20,
    )
