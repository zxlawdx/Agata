"""Configuração do aplicativo desktop Agata."""
APP_TITLE = "Agata"
APP_VERSION = "0.1.0"
APP_ICON = ""
APP_AUTHOR = ""
APP_DESCRIPTION = "Ambiente desktop de criação visual, esboços e componentes."
APP_FILE_EXTENSIONS = [".agata", ".yara"]  # arquivos antigos continuam reconhecidos

ENTRY_ROUTE = "/home"
WINDOW_WIDTH = 1440
WINDOW_HEIGHT = 900
LAYOUT = {"sidebar": False, "topbar": False, "theme": "dark"}

API = {
    "enabled": True,
    "host": "127.0.0.1",
    "port": 8000,
    "auto_port": True,
    "server": "waitress",
    "workers": 4,
    "docs_enabled": False,
}
DEBUG = True
STATIC_ROOT = "staticfiles"

# All runtime assets are committed; collectstatic never needs Node or Tailwind.
ASSETS = {"tailwind": False}
