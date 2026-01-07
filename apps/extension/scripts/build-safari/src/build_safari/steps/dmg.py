"""DMG creation step using dmgbuild."""

from collections.abc import Awaitable, Callable
from pathlib import Path

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

        # Resolve paths relative to script directory
        app_path = config.app_path
        settings_path = config.script_dir / "dmg_settings.py"

        # Background and icon paths are relative to dmg_settings.py location
        # They need to be resolved relative to script_dir
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
            raise BuildStepError(self.name, f"Background image not found: {background_path}")
        if not icon_path.exists():
            raise BuildStepError(self.name, f"Volume icon not found: {icon_path}")

        try:
            await on_output("Building DMG...\n")

            # Use dmgbuild to create the DMG
            # Note: settings_file is the path to config, settings is for in-memory dict
            dmgbuild.build_dmg(
                filename=str(output_path),
                volume_name=dmg_config.title,
                settings_file=str(settings_path),
                defines={
                    "app": str(app_path),
                    "background": str(background_path),
                    "icon": str(icon_path),
                    "app_position_x": str(dmg_config.app_position[0]),
                    "app_position_y": str(dmg_config.app_position[1]),
                    "applications_position_x": str(dmg_config.applications_position[0]),
                    "applications_position_y": str(dmg_config.applications_position[1]),
                    "icon_size": str(dmg_config.icon_size),
                    "window_x": str(dmg_config.window_position[0]),
                    "window_y": str(dmg_config.window_position[1]),
                    "window_width": str(dmg_config.window_size[0]),
                    "window_height": str(dmg_config.window_size[1]),
                },
            )

            await on_output(f"\033[32m✓ DMG created: {output_path}\033[0m\n")

        except Exception as e:
            raise BuildStepError(self.name, f"Failed to create DMG: {e}") from e

    def should_run(self, config: BuildConfig) -> bool:
        """Run for dmg and rebuild-dmg build types."""
        return config.build_type in ("dmg", "rebuild-dmg")
