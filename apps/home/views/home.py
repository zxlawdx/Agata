"""Home Agata: contexto de navegação do Vela + valores seguros."""
from config.settings import APP_VERSION
from vela.template_engine import mark_safe, render_template


def home_view(params: dict) -> str:
    section = params.get("section", "home")
    if section not in {"home", "projects", "templates"}:
        section = "home"
    context = {"app_version": APP_VERSION, "home_start": section,
               "home_create": "1" if params.get("create") is True else "0"}
    for name in ("sidebar", "project_modal"):
        context[name] = mark_safe(render_template(
            f"apps/home/templates/components/{name}.html", context,
            router=params["router"],
        ))
    return render_template(
        "apps/home/templates/home.html",
        context,
        router=params["router"],
    )
