"""Per-user appearance preferences stored in ``users.ui_prefs``.

Three independent knobs, all optional, all falling back to the built-in dark
theme when absent:

- ``theme``: colour overrides for the global palette slots (page background,
  card surface, border, accent, text, muted text). The frontend maps each slot
  to a CSS custom property (``--wq-bg`` etc.) that every surface reads from.
- ``card_colors``: per-tracker card tint, keyed by feature key. Overrides the
  ``card`` slot for that tracker's dashboard card and its own page.
- ``hidden_sections``: non-tracker dashboard chrome the user doesn't want
  (XP bar, streak badges, the "+ Log" buttons, the version footer). Trackers
  themselves are hidden via /features, not here.

Colours are ``#rrggbb`` only — the settings page uses ``<input type="color">``,
which can't express alpha, and a fixed shape keeps the CSS injection surface
to a regex-checked literal.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.features import FEATURE_KEYS

HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]

# Order defines display order on Settings -> Appearance.
UI_SECTIONS: tuple[tuple[str, str], ...] = (
    ("xp_bar", "Level & XP bar"),
    ("streaks", "Streak badges"),
    ("quick_log", "\"+ Log\" buttons on dashboard cards"),
    ("version_footer", "Version footer"),
)
UI_SECTION_KEYS: frozenset[str] = frozenset(k for k, _ in UI_SECTIONS)

UiSection = Literal["xp_bar", "streaks", "quick_log", "version_footer"]


class UiTheme(BaseModel):
    model_config = ConfigDict(extra="forbid")

    background: HexColor | None = None
    card: HexColor | None = None
    border: HexColor | None = None
    accent: HexColor | None = None
    text: HexColor | None = None
    muted: HexColor | None = None


class UiPrefs(BaseModel):
    model_config = ConfigDict(extra="forbid")

    theme: UiTheme = Field(default_factory=UiTheme)
    card_colors: dict[str, HexColor] = Field(default_factory=dict)
    hidden_sections: list[UiSection] = Field(default_factory=list)

    @field_validator("card_colors")
    @classmethod
    def _known_feature_keys(cls, value: dict[str, str]) -> dict[str, str]:
        unknown = sorted(set(value) - FEATURE_KEYS)
        if unknown:
            raise ValueError(f"unknown feature key(s): {', '.join(unknown)}")
        return value

    @field_validator("hidden_sections")
    @classmethod
    def _dedupe(cls, value: list[str]) -> list[str]:
        seen: list[str] = []
        for item in value:
            if item not in seen:
                seen.append(item)
        return seen

    def to_row(self) -> dict[str, Any]:
        """Compact form for the JSONB column: unset slots are dropped."""
        return self.model_dump(exclude_none=True)


def ui_prefs_from_row(raw: dict[str, Any] | None) -> UiPrefs:
    """Build the API shape from a stored row, dropping anything the current
    code no longer knows (a tracker that was removed, a renamed section) rather
    than failing /me over a stale preference."""
    raw = raw or {}
    theme_raw = raw.get("theme") or {}
    theme = {k: v for k, v in theme_raw.items() if k in UiTheme.model_fields}
    card_colors = {
        k: v for k, v in (raw.get("card_colors") or {}).items() if k in FEATURE_KEYS
    }
    hidden = [s for s in (raw.get("hidden_sections") or []) if s in UI_SECTION_KEYS]
    try:
        return UiPrefs(theme=UiTheme(**theme), card_colors=card_colors, hidden_sections=hidden)
    except ValueError:
        # A malformed colour written outside the API — fall back to defaults
        # rather than bricking the app for this user.
        return UiPrefs()
