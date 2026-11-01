"""Original, versioned tokens shared by platform adapters and editable templates."""

from copy import deepcopy

BASE = {
    "colors": {
        "background": "#F7F8FC",
        "surface": "#FFFFFF",
        "surfaceVariant": "#E8ECF5",
        "primary": "#5551D8",
        "secondary": "#56718B",
        "accent": "#18A787",
        "textPrimary": "#172033",
        "textSecondary": "#526078",
        "border": "#D7DEEB",
        "error": "#B42343",
        "success": "#137A58",
    },
    "typography": {
        "display": {"size": 48, "weight": 800, "lineHeight": 56},
        "headline": {"size": 32, "weight": 700, "lineHeight": 40},
        "title": {"size": 22, "weight": 700, "lineHeight": 28},
        "body": {"size": 16, "weight": 400, "lineHeight": 24},
        "label": {"size": 13, "weight": 600, "lineHeight": 18},
    },
    "spacing": {"xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 40},
    "shapes": {"none": 0, "sm": 8, "md": 14, "lg": 22, "xl": 32, "pill": 999},
    "motion": {
        "fast": 120,
        "normal": 240,
        "slow": 420,
        "easing": "cubic-bezier(.2,.8,.2,1)",
        "spring": {"damping": 0.8, "stiffness": 300},
    },
}
PALETTES = {
    "music-dark": {
        "background": "#101318",
        "surface": "#1B2028",
        "surfaceVariant": "#28303B",
        "primary": "#73E2A7",
        "accent": "#B2F57C",
        "textPrimary": "#F3F8F5",
        "textSecondary": "#B0C1BD",
        "border": "#35443E",
        "secondary": "#B5A7F4",
    },
    "social-modern": {
        "background": "#F6F4FA",
        "surface": "#FFFFFF",
        "surfaceVariant": "#F0EAF8",
        "primary": "#7450D8",
        "accent": "#EB6D8A",
        "textPrimary": "#241B35",
        "textSecondary": "#716580",
    },
    "editorial-minimal": {
        "background": "#F4F0E8",
        "surface": "#FFFCF6",
        "surfaceVariant": "#EAE2D4",
        "primary": "#79543B",
        "accent": "#A94C35",
        "textPrimary": "#2D2822",
        "textSecondary": "#756B5F",
    },
    "fintech-premium": {
        "background": "#0D1729",
        "surface": "#16243A",
        "surfaceVariant": "#20324C",
        "primary": "#6CD5E8",
        "accent": "#D2EB91",
        "textPrimary": "#F0F5FF",
        "textSecondary": "#AABBD1",
        "border": "#314763",
    },
    "material-expressive": {
        "background": "#F5F0FF",
        "surface": "#FFFBFF",
        "surfaceVariant": "#E7DEFA",
        "primary": "#6750A4",
        "accent": "#A4CB8B",
        "textPrimary": "#231B30",
        "textSecondary": "#6B5C7C",
    },
    "glass-blur": {
        "background": "#13152C",
        "surface": "#252A49",
        "surfaceVariant": "#373D60",
        "primary": "#C4BAFF",
        "accent": "#7DE5D2",
        "textPrimary": "#F5F4FF",
        "textSecondary": "#C0C5DF",
        "border": "#565E86",
    },
}


def tokens(style="material-expressive"):
    result = deepcopy(BASE)
    result["colors"].update(PALETTES.get(style, {}))
    return result


def css_tokens(value):
    lines = []
    for category, items in value.items():
        for name, v in items.items():
            if isinstance(v, dict):
                for key, scalar in v.items():
                    if type(scalar) in (int, float, str):
                        lines.append(
                            f'  --{category}-{name}-{key}: {scalar}{"px" if key in {"size","lineHeight"} else ""};'
                        )
            elif type(v) in (int, float, str):
                lines.append(
                    f'  --{category}-{name}: {v}{"px" if category in {"spacing","shapes"} else "ms" if category=="motion" and type(v) in (int,float) else ""};'
                )
    return ":root {\n" + "\n".join(lines) + "\n}\n"


import re


def validate_tokens(theme):
    if not isinstance(theme, dict):
        raise ValueError("Design tokens inválidos")
    for name in BASE["colors"]:
        if not re.fullmatch(
            r"#[0-9A-Fa-f]{6}", str(theme.get("colors", {}).get(name, ""))
        ):
            raise ValueError("Cor de token inválida: " + name)
    for group in ["spacing", "shapes"]:
        for key in BASE[group]:
            value = theme.get(group, {}).get(key)
            if type(value) not in (int, float) or not 0 <= value <= 1000:
                raise ValueError("Token de dimensão inválido")
    for role in BASE["typography"]:
        for field in ["size", "weight", "lineHeight"]:
            value = theme.get("typography", {}).get(role, {}).get(field)
            if type(value) not in (int, float) or not 1 <= value <= 1000:
                raise ValueError("Token tipográfico inválido")
    for key in ["fast", "normal", "slow"]:
        value = theme.get("motion", {}).get(key)
        if type(value) is not int or not 0 <= value <= 10000:
            raise ValueError("Token de motion inválido")
    return theme
