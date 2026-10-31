"""Original template metadata; implementations are platform adapters."""

from apps.design_system.services.tokens import tokens

ANDROID = [
    ("music-dark", "Music Dark", "media"),
    ("social-modern", "Social Modern", "social"),
    ("editorial-minimal", "Editorial Minimal", "editorial"),
    ("fintech-premium", "Fintech Premium", "finance"),
    ("material-expressive", "Material Expressive", "adaptive"),
    ("glass-blur", "Glass / Blur", "visual"),
]
WEB = [
    ("saas-dashboard", "SaaS Dashboard", "application"),
    ("premium-landing", "Premium Landing", "marketing"),
    ("creative-portfolio", "Creative Portfolio", "portfolio"),
    ("social-web", "Social Web App", "social"),
    ("ecommerce", "E-commerce", "commerce"),
    ("blog-editorial", "Blog / Editorial", "editorial"),
    ("authentication-web", "Login & Authentication UI", "forms"),
    ("admin-panel", "Admin Panel", "application"),
]


def catalog(platform=None):
    items = [
        {
            "id": key,
            "name": name,
            "platform": p,
            "category": category,
            "version": "1.0.0",
            "license": "original",
            "tags": [category, "editable", "responsive"],
            "assets": [],
            "designTokens": tokens(
                key
                if p == "android"
                else (
                    "editorial-minimal"
                    if key == "blog-editorial"
                    else (
                        "social-modern"
                        if key == "social-web"
                        else (
                            "glass-blur"
                            if key == "creative-portfolio"
                            else "material-expressive"
                        )
                    )
                )
            ),
            "updateStrategy": "Copy into a project; template updates never overwrite project edits.",
        }
        for p, rows in [("android", ANDROID), ("web", WEB)]
        for key, name, category in rows
    ]
    return [i for i in items if platform is None or i["platform"] == platform]


def get(template_id, platform):
    result = next((i for i in catalog(platform) if i["id"] == template_id), None)
    if not result:
        raise ValueError("Template não encontrado para esta plataforma.")
    return result
