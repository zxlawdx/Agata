"""Read-only, sandboxed gallery previews derived from real editable template sources.

These previews never run a template's JavaScript or host privileged APIs.
"""
from __future__ import annotations

from html import escape
import re

from apps.template_registry.registry import catalog
from apps.design_system.services.tokens import tokens


_STYLE = """
*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:system-ui,sans-serif}
body{background:var(--background);color:var(--text);overflow-x:hidden}
.device{width:min(390px,100%);min-height:680px;margin:20px auto;padding:22px 18px 38px;border:2px solid #263045;
border-radius:24px;background:var(--surface);box-shadow:8px 12px 0 #26304524}
.device h1{font-size:24px;margin:10px 0 16px}.device h2{font-size:19px;margin:10px 0}
.node{margin:9px 0}.node-TextLabel{font-weight:600}.node-Button,.node-FloatingButton,.node-IconButton,
.node-NavigationItem{padding:12px 14px;border-radius:13px;background:var(--accent);color:var(--accentText);font-weight:700}
.node-Card,.node-MediaCard,.node-PlaylistCard,.node-DashboardCard{padding:14px;border-radius:16px;
border:1px solid var(--border);background:var(--background)}
.node-TextField{padding:13px;border:1px solid var(--border);border-radius:9px}
.node-Row,.node-BottomBar,.node-TopBar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.node-Column,.node-Region,.node-Box,.node-ConstraintLayout{display:flex;flex-direction:column;gap:8px}
.node-Chart{height:82px;border-radius:12px;background:linear-gradient(140deg,var(--accent),transparent 78%)}
.node-Avatar{width:54px;height:54px;border-radius:50%;background:var(--accent)}
.node-Switch,.node-Checkbox{width:33px;height:18px;border-radius:12px;border:2px solid var(--accent)}
.node-Divider{height:1px;background:var(--border)}
.preview-caption{font-size:12px;color:var(--muted);margin:10px 0}
"""


def _android_node(node, depth=0):
    if depth > 20:
        return ""
    kind = node.get("type", "Box")
    props = node.get("props") or {}
    children = "".join(_android_node(child, depth + 1) for child in node.get("children", []))
    text = props.get("text") or props.get("label") or ""
    if kind == "TextLabel":
        inner = escape(str(text or node.get("name", "Texto")))
    elif kind == "TextField":
        inner = escape(str(props.get("label") or "Campo de texto"))
    elif kind in {"TopBar", "BottomBar"}:
        inner = children or escape(kind)
        children = ""
    elif kind in {"Button", "NavigationItem", "FloatingButton", "IconButton"}:
        inner = children or escape(str(text or "Botão"))
        children = ""
    else:
        inner = children
        children = ""
    return '<div class="node node-%s">%s%s</div>' % (escape(kind, quote=True), inner, children)


def _android_preview(template_id):
    from apps.android_designer.domain.templates import template_document

    document = template_document(template_id)
    first = document["screens"][0]
    scheme = tokens(template_id).get("colors", {})
    css = (
        "--background:%s;--surface:%s;--text:%s;--muted:%s;--accent:%s;"
        "--accentText:%s;--border:%s"
    ) % (
        scheme.get("background", "#fff9ef"),
        scheme.get("surface", "#ffffff"),
        scheme.get("textPrimary", "#222"),
        scheme.get("textSecondary", "#666"),
        scheme.get("primary", "#53aff2"),
        scheme.get("surface", "#ffffff"),
        scheme.get("border", "#ccd"),
    )
    inner = _android_node(first["root"])
    html = (
        '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<style>:root{' + css + '}' + _STYLE + '</style></head><body>'
        '<main class="device"><p class="preview-caption">%s · prévia esquemática editável</p>%s</main>'
        '</body></html>'
    ) % (escape(first["name"]), inner)
    return {"html": html, "kind": "android-model", "screens": len(document["screens"])}


def _web_preview(template_id):
    from apps.web_studio.services.templates import template_files

    files, metadata = template_files(template_id)
    html = files["index.html"]
    # Resolve only literal, known component references from the generated template.
    def replace_include(match):
        path = "components/" + match.group(1) + ".html"
        return files.get(path, "")
    html = re.sub(
        r'<agata-include\\s+src="components/([a-z0-9_-]+)\\.html"\\s*></agata-include>',
        replace_include, html,
    )
    html = re.sub(r'<script\\b[^>]*>.*?</script>', "", html, flags=re.I | re.S)
    html = re.sub(r'<link\\b[^>]*rel="stylesheet"[^>]*>', "", html, flags=re.I)
    stylesheet = "\\n".join(files[x] for x in (
        "css/tokens.css", "css/base.css", "css/layout.css",
        "css/components.css", "css/responsive.css",
    ) if x in files)
    # Previews are static and isolated in a sandboxed iframe; live projects use the real runtime.
    html = html.replace("</head>", "<style>" + stylesheet + "</style></head>", 1)
    return {"html": html, "kind": "web-source", "screens": 3,
            "files": len(files), "entry": metadata["entry"]}


def gallery_catalog():
    from apps.android_designer.domain.templates import TEMPLATES
    registered = [dict(item) for item in catalog()]
    registered_ids = {item["id"] for item in registered if item["platform"] == "android"}
    for key, name in TEMPLATES.items():
        if key not in registered_ids:
            registered.append({
                "id": key, "name": name, "platform": "android",
                "category": "starter", "version": "1.0.0",
                "license": "original", "tags": ["starter", "editable"],
                "updateStrategy": "Copiado como novo projeto; mudanças não sobrescrevem edições.",
            })
    return registered


def preview(template_id, platform):
    if not isinstance(template_id, str) or not isinstance(platform, str):
        raise ValueError("Identificação de template inválida.")
    if not any(item["id"] == template_id and item["platform"] == platform
               for item in gallery_catalog()):
        raise ValueError("Template não encontrado.")
    return _web_preview(template_id) if platform == "web" else _android_preview(template_id)
