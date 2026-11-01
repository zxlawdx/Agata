"""Portable entrance presets; state transitions remain explicit in native source."""

PRESETS = {"fade", "scale", "slide", "expand"}


def validate_motion(value):
    if (
        not isinstance(value, dict)
        or set(value) - {"preset", "duration"}
        or value.get("preset") not in PRESETS
        or type(value.get("duration")) is not int
        or not 0 <= value["duration"] <= 10000
    ):
        raise ValueError("Motion requer preset suportado e duração entre 0 e 10000 ms.")
