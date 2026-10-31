from vela.template_engine import render_template
import re


def studio_view(params):
    project_id = str(params.get("project_id") or "")
    if project_id and not re.fullmatch(r"[0-9a-f]{32}", project_id):
        raise ValueError("ID de projeto inválido")
    return render_template(
        "apps/web_studio/templates/studio.html",
        {"project_id": project_id},
        router=params["router"],
    )


def register_routes(router):
    router.add(
        "/web",
        studio_view,
        name="web",
        title="Agata Web Studio",
        layout="blank",
        show_in_sidebar=False,
    )
