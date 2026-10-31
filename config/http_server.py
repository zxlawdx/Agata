"""Vela HTTP adapter: bootstrap the native capability before shell scripts run."""

from functools import wraps
from vela.core.api_server import ApiServer
from bottle import response
from .native_security import bootstrap_script


class NativeBootstrapPlugin:
    name = "agata-native-bootstrap"
    api = 2

    def apply(self, callback, route):
        if route.rule != "/__vela__/shell":
            return callback

        @wraps(callback)
        def trusted_shell(*args, **kwargs):
            content = callback(*args, **kwargs)
            response.headers["Cache-Control"] = "no-store"
            if not isinstance(content, str) or "<head>" not in content:
                raise RuntimeError(
                    "Vela shell changed; native bootstrap requires review."
                )
            return content.replace("<head>", "<head>" + bootstrap_script(), 1)

        return trusted_shell


class AgataApiServer(ApiServer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.app.install(NativeBootstrapPlugin())
