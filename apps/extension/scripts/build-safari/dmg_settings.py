"""DMG settings for dmgbuild.

This file is used by dmgbuild to configure the appearance and layout
of the DMG installer. Values are passed via the 'defines' parameter.

Coordinate system:
- Both appdmg and dmgbuild use the same coordinate system
- x, y = icon center position in points from left/top of window
- Coordinates transfer directly between the two tools
"""

import os

# Variables passed via dmgbuild --define
application = defines.get("app")  # noqa: F821 - 'defines' is injected by dmgbuild
appname = os.path.basename(application)

# Icon positions (passed from config)
app_x = int(defines.get("app_position_x", "151"))  # noqa: F821
app_y = int(defines.get("app_position_y", "279"))  # noqa: F821
applications_x = int(defines.get("applications_position_x", "510"))  # noqa: F821
applications_y = int(defines.get("applications_position_y", "274"))  # noqa: F821

# Window settings (passed from config)
window_x = int(defines.get("window_x", "200"))  # noqa: F821
window_y = int(defines.get("window_y", "120"))  # noqa: F821
window_width = int(defines.get("window_width", "660"))  # noqa: F821
window_height = int(defines.get("window_height", "480"))  # noqa: F821

# Volume contents
files = [application]
symlinks = {"Applications": "/Applications"}

# Icon positions (same coordinates as appdmg - both use icon center)
icon_locations = {
    appname: (app_x, app_y),
    "Applications": (applications_x, applications_y),
}

# Window appearance
background = defines.get("background")  # noqa: F821 - Path to background image
icon = defines.get("icon")  # noqa: F821 - Volume icon (.icns)
icon_size = int(defines.get("icon_size", "175"))  # noqa: F821
window_rect = ((window_x, window_y), (window_width, window_height))

# Disable Finder's auto-arrange (required for manual positioning)
arrange_by = None

# Text size for icon labels
text_size = 12

# Format: UDBZ is compressed, UDRO is read-only
format = "UDBZ"
