"""Compose entrance wrapper observes the system animator scale and project preference."""


def wrap(generator, node, omit):
    from apps.android_designer.domain.motion import validate_motion

    motion = node["motion"]
    validate_motion(motion)
    content = generator.emit({**node, "_motion_applied": True}, omit)
    if generator.doc.get("motionSettings", {}).get("reduced") or generator.doc.get(
        "design_system", {}
    ).get("motion", {}).get("reduced"):
        return content
    duration = motion["duration"]
    spec = "tween(durationMillis = " + str(duration) + ")"
    enter = {
        "fade": "fadeIn(" + spec + ")",
        "scale": "fadeIn("
        + spec
        + ") + scaleIn(animationSpec = "
        + spec
        + ", initialScale = 0.94f)",
        "slide": "fadeIn("
        + spec
        + ") + slideInVertically(animationSpec = "
        + spec
        + ") { it / 8 }",
        "expand": "expandVertically(animationSpec = "
        + spec
        + ") + fadeIn("
        + spec
        + ")",
    }[motion["preset"]]
    return (
        'key("'
        + node["id"]
        + '") { val motionContext = LocalContext.current; val reduceMotion = android.provider.Settings.Global.getFloat(motionContext.contentResolver, android.provider.Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f; var motionVisible by remember { mutableStateOf(reduceMotion) }; LaunchedEffect(Unit) { motionVisible = true }; AnimatedVisibility(visible = motionVisible, enter = if (reduceMotion) EnterTransition.None else '
        + enter
        + ", exit = ExitTransition.None) { "
        + content
        + " } }"
    )
