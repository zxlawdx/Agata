"""Native overlay lifecycle for editable premium surface compositions."""


def wrap(generator, node, omit):
    content = generator.emit({**node, "_presentation_applied": True}, omit)
    visible = (
        "false" if node.get("states", {}).get("initialVisible") is False else "true"
    )
    state = "overlay_" + node["id"]
    body = (
        (
            "ModalBottomSheet"
            if node["componentDefinition"] == "BottomSheet"
            else "androidx.compose.ui.window.Dialog"
        )
        + "(onDismissRequest = { "
        + state
        + " = false }) { "
        + content
        + " }"
    )
    return (
        'key("'
        + node["id"]
        + '") { var '
        + state
        + " by rememberSaveable { mutableStateOf("
        + visible
        + ") }; if ("
        + state
        + ") { "
        + body
        + " } }"
    )
