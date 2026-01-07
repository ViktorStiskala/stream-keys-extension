"""UI components for Safari build tool."""

from build_safari.ui.protocol import BuildUI
from build_safari.ui.simple import SimpleUI

__all__ = ["BuildUI", "SimpleUI"]

# Conditional import of TUI to avoid textual dependency issues
def get_tui_class() -> type:
    """Get the TUI class (lazy import to avoid textual issues)."""
    from build_safari.ui.app import BuildApp
    return BuildApp
