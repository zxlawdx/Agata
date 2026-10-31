"""Authenticate Agata's native transport, including engine-level subframe channels.

An opaque iframe alone is insufficient on engines exposing a message handler to
all frames. Only the trusted Vela shell receives this per-process capability.
"""

from functools import wraps
from secrets import token_urlsafe
from hmac import compare_digest
import json
import sys

SESSION_TOKEN = token_urlsafe(48)
INTERNAL_CALLS = frozenset(
    {
        "pywebviewAsyncCallback",
        "pywebviewMoveWindow",
        "pywebviewEventHandler",
        "pywebviewStateUpdate",
        "pywebviewStateDelete",
    }
)


def bootstrap_script():
    # This is inserted only into the framework shell, never into project files.
    return (
        "<script>"
        + r"""(()=>{'use strict';if(window.top!==window)return;const capability="""
        + json.dumps(SESSION_TOKEN)
        + r""";const install=()=>{const bridge=window.pywebview;if(!bridge||typeof bridge._jsApiCallback!=='function'||bridge._agataTransportGuard)return;const dispatch=bridge._jsApiCallback;bridge._jsApiCallback=function(name,params,id){return dispatch.call(this,name,{agataTransport:1,capability,params},id)};Object.defineProperty(bridge,'_agataTransportGuard',{value:true});};addEventListener('pywebviewready',install,{capture:true});install();})();"""
        + "</script>"
    )


def guarded_dispatcher(original):
    from config.bridge import AgataBridge

    allowed = {
        name
        for name in dir(AgataBridge)
        if not name.startswith("_") and callable(getattr(AgataBridge, name, None))
    } | INTERNAL_CALLS

    @wraps(original)
    def dispatch(window, name, parameters, value_id):
        if not isinstance(getattr(window, "_js_api", None), AgataBridge):
            return original(window, name, parameters, value_id)
        if not isinstance(name, str) or name not in allowed:
            return False
        try:
            envelope = (
                json.loads(parameters) if isinstance(parameters, str) else parameters
            )
        except (ValueError, TypeError):
            return False
        if not isinstance(envelope, dict) or envelope.get("agataTransport") != 1:
            return False
        capability = envelope.get("capability")
        if (
            not isinstance(capability, str)
            or len(capability) != len(SESSION_TOKEN)
            or not capability.isascii()
            or not compare_digest(capability, SESSION_TOKEN)
        ):
            return False
        return original(window, name, envelope.get("params"), value_id)

    dispatch._agata_guard = True
    return dispatch


def install_transport_guard():
    import webview.util

    original = webview.util.js_bridge_call
    if getattr(original, "_agata_guard", False):
        return
    guarded = guarded_dispatcher(original)
    webview.util.js_bridge_call = guarded
    # Also cover already selected engines when embedding/restarting the app.
    for name, module in tuple(sys.modules.items()):
        if (
            name.startswith("webview.platforms.")
            and getattr(module, "js_bridge_call", None) is original
        ):
            module.js_bridge_call = guarded
