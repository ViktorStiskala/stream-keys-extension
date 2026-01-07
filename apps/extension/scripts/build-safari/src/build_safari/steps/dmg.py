"""DMG creation step using dmgbuild."""

import asyncio
from collections.abc import Awaitable, Callable

import dmgbuild

from build_safari.config import BuildConfig
from build_safari.steps.base import BuildStep, BuildStepError
from build_safari.utils.process import ProcessRunner


class DMGCreateStep(BuildStep):
    """Create styled DMG using dmgbuild."""

    def __init__(self) -> None:
        """Initialize the DMG creation step."""
        super().__init__("Creating styled DMG...")

    async def execute(
        self,
        config: BuildConfig,
        runner: ProcessRunner,
        on_output: Callable[[str], Awaitable[None]],
    ) -> None:
        """Create DMG using dmgbuild.

        Args:
            config: Build configuration
            runner: Process runner for executing commands
            on_output: Async callback for command output

        Raises:
            BuildStepError: If DMG creation fails
        """
        output_path = config.output_path
        dmg_config = config.app.dmg

        # Remove existing DMG if present
        if output_path.exists():
            output_path.unlink()
            await on_output(f"Removed existing DMG: {output_path}\n")

        # Resolve paths
        app_path = config.app_path
        app_name = app_path.name  # e.g., "Stream Keys.app"

        # Background and icon paths are relative to script_dir
        background_path = (config.script_dir / dmg_config.background).resolve()
        icon_path = (config.script_dir / dmg_config.icon).resolve()

        await on_output(f"App: {app_path}\n")
        await on_output(f"Background: {background_path}\n")
        await on_output(f"Icon: {icon_path}\n")
        await on_output(f"Output: {output_path}\n")

        # Verify paths exist
        if not app_path.exists():
            raise BuildStepError(self.name, f"App not found: {app_path}")
        if not background_path.exists():
            raise BuildStepError(
                self.name, f"Background image not found: {background_path}"
            )
        if not icon_path.exists():
            raise BuildStepError(self.name, f"Volume icon not found: {icon_path}")

        try:
            await on_output("Building DMG...\n")

            # Build settings dict dynamically from config
            # See dmgbuild documentation for all available options
            settings = {
                # Volume contents
                "files": [str(app_path)],
                "symlinks": {"Applications": "/Applications"},
                # Icon positions (coordinates are icon center)
                "icon_locations": {
                    app_name: dmg_config.app_position,
                    "Applications": dmg_config.applications_position,
                },
                # Window appearance
                "background": str(background_path),
                "icon": str(icon_path),
                "icon_size": dmg_config.icon_size,
                "text_size": dmg_config.text_size,
                "window_rect": (
                    dmg_config.window_position,
                    dmg_config.window_size,
                ),
                # Finder view options
                "show_pathbar": dmg_config.show_pathbar,
                "show_status_bar": dmg_config.show_status_bar,
                "show_sidebar": dmg_config.show_sidebar,
                "show_toolbar": dmg_config.show_toolbar,
                # Disable Finder's auto-arrange (required for manual positioning)
                "arrange_by": None,
                # Format: UDBZ is compressed
                "format": "UDBZ",
            }

            # Add hide_extensions if configured (hides .app extension in Finder)
            if dmg_config.hide_extensions:
                settings["hide_extensions"] = dmg_config.hide_extensions

            # Use dmgbuild with in-memory settings (no settings file needed)
            # Run in thread to avoid blocking the event loop (allows UI updates)
            await asyncio.to_thread(
                dmgbuild.build_dmg,
                filename=str(output_path),
                volume_name=dmg_config.title,
                settings=settings,
            )

            await on_output(f"\033[32m✓ DMG created: {output_path}\033[0m\n")

        except Exception as e:
            raise BuildStepError(self.name, f"Failed to create DMG: {e}") from e

    def should_run(self, config: BuildConfig) -> bool:
        """Run for dmg and rebuild-dmg build types."""
        return config.build_type in ("dmg", "rebuild-dmg")
