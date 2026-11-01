"""Original premium compositions built from Agata's existing editable node primitives."""

from copy import deepcopy
import re, unicodedata
from apps.android_designer.domain.model import (
    new_document,
    new_node,
    new_screen,
    walk,
    validate,
)
from apps.template_registry.registry import ANDROID, get
from .tokens import tokens

COMPONENTS = [
    "ModernAppBar",
    "SearchBar",
    "ProfileHeader",
    "SocialPost",
    "StoryRow",
    "MediaCard",
    "MusicPlayer",
    "MiniPlayer",
    "PlaylistCard",
    "MetricCard",
    "DashboardCard",
    "FloatingActionButton",
    "BottomNavigation",
    "NavigationRail",
    "ResponsiveNavigation",
    "SegmentedControl",
    "FilterChip",
    "BottomSheet",
    "Dialog",
    "LoadingSkeleton",
    "EmptyState",
    "ErrorState",
]


def bind(node, area, key, token, value):
    node.setdefault("tokenReferences", {})[area + "." + key] = token
    node[area][key] = value
    return node


def resolve_tokens(document, overrides=None):
    result = deepcopy(document)
    theme = result["design_system"]["tokens"]
    if overrides:
        for group, values in overrides.items():
            if group not in theme or not isinstance(values, dict):
                raise ValueError("Grupo de tokens inválido")
            theme[group].update(values)
    from .tokens import validate_tokens

    validate_tokens(theme)
    for screen in result["screens"]:
        for node in walk(screen["root"]):
            for key, reference in node.get("tokenReferences", {}).items():
                area, prop = key.split(".", 1)
                value = theme
                for part in reference.split("."):
                    value = value[part]
                # A component's explicit property override detaches its token binding.
                if key not in node.get("tokenOverrides", []):
                    node[area][prop] = deepcopy(value)
    result["theme"]["primary"] = theme["colors"]["primary"]
    return validate(result)


def component(name, theme, props=None, target=None):
    if name not in COMPONENTS:
        raise ValueError("Componente premium inexistente")
    props = props or {}
    c = theme["colors"]

    def text(value, size=16):
        n = new_node("TextLabel", {"text": value, "fontSize": size})
        bind(n, "props", "color", "colors.textPrimary", c["textPrimary"])
        role = {
            48: "display",
            32: "headline",
            22: "title",
            16: "body",
            13: "label",
        }.get(size)
        if role:
            bind(
                n,
                "props",
                "fontSize",
                "typography." + role + ".size",
                theme["typography"][role]["size"],
            )
        return n

    def button(value, action="custom", destination=""):
        n = new_node("Button")
        n["children"][-1]["props"]["text"] = value
        destination = (
            re.sub(
                r"[^a-zA-Z0-9_.]",
                "",
                unicodedata.normalize("NFKD", destination)
                .encode("ascii", "ignore")
                .decode(),
            )
            if action == "custom"
            else destination
        )
        n["events"] = {"onClick": {"action": action, "target": destination}}
        bind(n, "props", "background", "colors.primary", c["primary"])
        return n

    def box(kind="Card", children=None):
        n = new_node(kind)
        n["children"] = children or []
        n["layout"].update(width="fill", padding=16, gap=12)
        if "background" in n["props"]:
            bind(n, "props", "background", "colors.surface", c["surface"])
        return n

    if name == "ModernAppBar":
        title = text(props.get("title", "Agata Studio"), 22)
        title["role"] = "title"
        n = box("TopBar", [title])
    elif name == "SearchBar":
        n = new_node(
            "SearchBar",
            {"placeholder": props.get("placeholder", "Pesquisar na biblioteca")},
        )
    elif name == "ProfileHeader":
        n = box(
            "Column",
            [
                new_node("Avatar"),
                text(props.get("title", "Alex Morgan"), 26),
                text("Designer · Criando novas ideias", 14),
            ],
        )
    elif name == "StoryRow":
        n = box(
            "LazyRow",
            [
                box("Column", [new_node("Avatar"), text(label, 12)])
                for label in ["Você", "Luna", "Noah", "Maya"]
            ],
        )
        n["layout"]["height"] = 130
    elif name in {"MediaCard", "PlaylistCard", "SocialPost"}:
        art = new_node("Shape")
        art["props"].update(
            fill=c["accent"], stroke=c["surface"], kind="rect", radius=22
        )
        art["layout"].update(width="fill", height=150)
        n = box(
            "Card",
            [
                art,
                text(
                    props.get(
                        "title",
                        {
                            "MediaCard": "Novas perspectivas",
                            "PlaylistCard": "Horizontes sonoros",
                            "SocialPost": "Um novo olhar para o cotidiano",
                        }[name],
                    ),
                    22,
                ),
                text("Uma seleção original para descobrir.", 14),
                button(
                    "Abrir",
                    "navigate" if target else "custom",
                    target or "Abrir conteúdo",
                ),
            ],
        )
    elif name in {"MusicPlayer", "MiniPlayer"}:
        controls = box(
            "Row",
            [
                button("Anterior", destination="Faixa anterior"),
                button("Reproduzir / pausar", destination="Reprodução demonstrativa"),
                button("Próxima", destination="Próxima faixa"),
            ],
        )
        n = box(
            "Card",
            [
                text("Caminhos de luz", 22),
                text("Estúdio Horizonte · Áudio demonstrativo", 13),
                new_node("Slider"),
                controls,
            ],
        )
    elif name in {"MetricCard", "DashboardCard"}:
        n = box(
            "Card",
            [
                text(props.get("title", "Saldo disponível"), 14),
                text(props.get("value", "R$ 12.480,00"), 30),
                text("+8,4% neste mês", 13),
            ]
            + ([new_node("Chart")] if name == "DashboardCard" else []),
        )
    elif name == "FloatingActionButton":
        n = new_node("FloatingButton")
        n["events"] = {
            "onClick": {
                "action": "navigate" if target else "custom",
                "target": target or "CreateItem",
            }
        }
    elif name == "ResponsiveNavigation":
        bottom = component("BottomNavigation", theme, props, target)
        rail = component("NavigationRail", theme, props, target)
        bottom["layout"]["responsive"] = {
            key: {"visible": False}
            for key in ["medium", "expanded", "large", "extraLarge"]
        }
        rail["layout"]["visible"] = False
        rail["layout"]["responsive"] = {
            key: {
                "visible": True,
                "width": 220 if key in ["expanded", "large", "extraLarge"] else 80,
            }
            for key in ["medium", "expanded", "large", "extraLarge"]
        }
        n = box("Column", [bottom, rail])
    elif name in {"BottomNavigation", "NavigationRail"}:
        n = box("NavigationRail" if name == "NavigationRail" else "BottomBar", [])
        for title in ["Início", "Explorar", "Biblioteca"]:
            item = new_node("NavigationItem")
            item["children"][-1]["props"]["text"] = title
            item["props"]["selected"] = title == "Início"
            item["events"] = {
                "onClick": {
                    "action": "navigate" if target else "custom",
                    "target": target
                    or {
                        "Início": "Home",
                        "Explorar": "Explore",
                        "Biblioteca": "Library",
                    }[title],
                }
            }
            n["children"].append(item)
    elif name in {"SegmentedControl", "FilterChip"}:
        n = box(
            "Row",
            [
                button(label, destination="Filtro: " + label)
                for label in (
                    ["Todos", "Recentes", "Favoritos"]
                    if name == "SegmentedControl"
                    else ["Favoritos"]
                )
            ],
        )
    elif name in {"BottomSheet", "Dialog"}:
        # Explicit editable state composition, not a pretend native overlay API.
        n = box(
            "Surface",
            [
                text("Detalhes" if name == "BottomSheet" else "Confirmar ação", 22),
                text("Conteúdo editável da superfície"),
                button(
                    "Continuar",
                    "navigate" if target else "custom",
                    target or "Confirmar",
                ),
            ],
        )
        n["metadata"] = {
            "presentation": name,
            "initialState": "visible",
            "overlayRuntime": "compose-native",
        }
    elif name == "LoadingSkeleton":
        n = box(
            "Column",
            [new_node("Surface"), new_node("Surface"), new_node("ProgressIndicator")],
        )
        n["children"][0]["layout"].update(width="fill", height=24)
        n["children"][1]["layout"].update(width=180, height=16)
    elif name in {"EmptyState", "ErrorState"}:
        n = box(
            "Column",
            [
                text(
                    (
                        "Nada por aqui ainda"
                        if name == "EmptyState"
                        else "Não foi possível carregar"
                    ),
                    22,
                ),
                text(
                    "Adicione seu primeiro item."
                    if name == "EmptyState"
                    else "Confira a conexão e tente novamente."
                ),
                button(
                    "Criar item" if name == "EmptyState" else "Tentar novamente",
                    destination="Repetir ação",
                ),
            ],
        )
    else:
        raise ValueError(name)
    for child in walk(n):
        if "color" in child["props"] and not child.get("tokenReferences", {}).get(
            "props.color"
        ):
            bind(child, "props", "color", "colors.textPrimary", c["textPrimary"])
    n["name"] = name
    n["componentDefinition"] = name
    n["motion"] = {"preset": "fade", "duration": theme["motion"]["normal"]}
    n.setdefault("metadata", {})["license"] = "original"
    return n


def template_document(key):
    if key in {"music-dark", "social-modern", "fintech-premium"}:
        from .premium_experiences import build
        return build(key)
    meta = get(key, "android")
    theme = tokens(key)
    d = new_document()
    d["app_name"] = meta["name"]
    d["theme"].update(
        primary=theme["colors"]["primary"],
        dynamicColor=key == "material-expressive",
        darkMode=(
            "dark"
            if key in {"music-dark", "fintech-premium", "glass-blur"}
            else "light"
        ),
    )
    first = d["screens"][0]
    first["name"] = "Início"
    second = new_screen("Detalhes", 550, 80)
    d["screens"].append(second)
    d["design_system"] = {
        "version": 1,
        "template": meta,
        "tokens": theme,
        "components": COMPONENTS,
        "motion": {"reduced": False},
        "limitations": [
            "Music player uses configured demo actions; audio engine is not bundled.",
            "Glass style uses opaque contrast-safe fallback; native blur is not exported.",
            "BottomSheet/Dialog export native Compose overlays; browser previews show an approximate surface, and Android lifecycle has not been SDK-tested.",
        ],
    }

    def make(name, props=None, target=None):
        return component(name, theme, props, target)

    kinds = {
        "music-dark": ["SearchBar", "PlaylistCard", "MiniPlayer"],
        "social-modern": ["StoryRow", "ProfileHeader", "SocialPost"],
        "editorial-minimal": ["MediaCard", "MediaCard"],
        "fintech-premium": ["MetricCard", "DashboardCard"],
        "material-expressive": ["SearchBar", "SegmentedControl", "MediaCard"],
        "glass-blur": ["ProfileHeader", "DashboardCard"],
    }
    for screen in [first, second]:
        screen["root"] = new_node(
            "Surface", {"background": theme["colors"]["background"], "radius": 0}
        )
        root = screen["root"]
        root["layout"].update(
            width="fill", height="fill", padding=16, gap=16, scroll="vertical"
        )
        root["props"]["background"] = theme["colors"]["background"]
        bind(
            root,
            "props",
            "background",
            "colors.background",
            theme["colors"]["background"],
        )
        root["layout"]["responsive"] = {
            "medium": {"padding": 32},
            "expanded": {"padding": 48},
            "large": {"padding": 64},
            "extraLarge": {"padding": 80},
        }
    first["root"]["children"] = [make("ModernAppBar", {"title": meta["name"]})] + [
        make(k, target=second["id"]) for k in kinds[key]
    ]
    bottom = make("BottomNavigation", target=second["id"])
    bottom["layout"]["responsive"] = {
        "medium": {"visible": False},
        "expanded": {"visible": False},
        "large": {"visible": False},
        "extraLarge": {"visible": False},
    }
    rail = make("NavigationRail", target=second["id"])
    rail["layout"]["visible"] = False
    rail["layout"]["responsive"] = {
        key: {"visible": True} for key in ["medium", "expanded", "large", "extraLarge"]
    }
    body = new_node("Column")
    body["layout"].update(
        width="fill", height="fill", weight=1, scroll="vertical", gap=16
    )
    body["children"] = first["root"]["children"] + [bottom]
    rail["layout"].update(width=80, height="fill")
    rail["layout"]["responsive"].update(
        {
            key: {"visible": True, "width": 220}
            for key in ["expanded", "large", "extraLarge"]
        }
    )
    row = new_node("Row")
    row["layout"].update(width="fill", height="fill", gap=16)
    row["children"] = [rail, body]
    first["root"]["layout"]["scroll"] = "none"
    first["root"]["children"] = [row]
    second["root"]["children"] = [
        make("ModernAppBar", {"title": "Sua próxima descoberta"}),
        make("MediaCard", target=first["id"]),
        make("EmptyState"),
    ]
    back = new_node("Button")
    back["children"][-1]["props"]["text"] = "Voltar"
    back["events"] = {"onClick": {"action": "back"}}
    second["root"]["children"].append(back)
    return resolve_tokens(d)
