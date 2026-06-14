"""ISO week helpers. Collections are keyed by ISO year + ISO week number."""

from datetime import date


def current_iso_week() -> tuple[int, int]:
    """Return the current (ISO year, ISO week)."""
    iso = date.today().isocalendar()
    return iso.year, iso.week
