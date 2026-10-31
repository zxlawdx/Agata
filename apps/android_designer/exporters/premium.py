"""Typed Compose tokens for original premium projects; no extra runtime dependency."""

from apps.design_system.services.tokens import BASE, validate_tokens


def scheme(document):
    theme = validate_tokens(document["design_system"]["tokens"])
    c = theme["colors"]
    return {
        key: c[value]
        for key, value in {
            "primary": "primary",
            "secondary": "secondary",
            "tertiary": "accent",
            "background": "background",
            "surface": "surface",
            "surfaceVariant": "surfaceVariant",
            "onBackground": "textPrimary",
            "onSurface": "textPrimary",
            "onSurfaceVariant": "textSecondary",
            "outline": "border",
            "error": "error",
        }.items()
    }


def files(document):
    theme = validate_tokens(document["design_system"]["tokens"])
    namespace = document["namespace"]
    base = "app/src/main/java/" + namespace.replace(".", "/") + "/ui/theme/"
    declarations = []
    for name, color in theme["colors"].items():
        if name not in BASE["colors"]:
            continue
        declarations.append(" val " + name + " = Color(0xFF" + color[1:] + ")")
    for group in ["spacing", "shapes"]:
        for name, value in theme[group].items():
            if name in BASE[group]:
                declarations.append(
                    " val " + group + name.title() + " = " + str(float(value)) + ".dp"
                )
    for name in ["fast", "normal", "slow"]:
        declarations.append(
            " const val motion" + name.title() + " = " + str(theme["motion"][name])
        )
    tokens = (
        "package "
        + namespace
        + ".ui.theme\nimport androidx.compose.ui.graphics.Color\nimport androidx.compose.ui.unit.dp\nobject AgataTokens {\n"
        + "\n".join(declarations)
        + "\n}\n"
    )
    roles = {
        "displayLarge": "display",
        "headlineLarge": "headline",
        "titleLarge": "title",
        "bodyLarge": "body",
        "labelLarge": "label",
    }
    styles = []
    for compose, role in roles.items():
        value = theme["typography"][role]
        styles.append(
            compose
            + " = TextStyle(fontSize = "
            + str(float(value["size"]))
            + ".sp, lineHeight = "
            + str(float(value["lineHeight"]))
            + ".sp, fontWeight = FontWeight("
            + str(int(value["weight"]))
            + "))"
        )
    typography = (
        "package "
        + namespace
        + ".ui.theme\nimport androidx.compose.material3.Typography\nimport androidx.compose.ui.text.TextStyle\nimport androidx.compose.ui.text.font.FontWeight\nimport androidx.compose.ui.unit.sp\nval AgataTypography = Typography(\n"
        + ",\n".join(styles)
        + "\n)\n"
    )
    return {base + "AgataTokens.kt": tokens, base + "Type.kt": typography}
