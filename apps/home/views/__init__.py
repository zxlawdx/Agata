"""Rota visual da página inicial do Yara."""
from apps.home.views.home import home_view


def register_routes(router):
    router.add(
        "/home",
        home_view,
        name="home",
        title="Início",
        layout="blank",
        show_in_sidebar=False,
        order=0,
    )
