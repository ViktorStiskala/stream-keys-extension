"""Xcode build steps for Safari extension."""

import re
import shutil
from collections.abc import Awaitable, Callable
from pathlib import Path

from build_safari.config import BuildConfig
from build_safari.steps.base import BuildStep, BuildStepError
from build_safari.utils.process import ProcessRunner


class XcodeConvertStep(BuildStep):
    """Convert Safari extension to Xcode project."""

    def __init__(self) -> None:
        """Initialize the Xcode conversion step."""
        super().__init__("Converting to Xcode project...")

    async def execute(
        self,
        config: BuildConfig,
        runner: ProcessRunner,
        on_output: Callable[[str], Awaitable[None]],
    ) -> None:
        """Convert Safari extension to Xcode project.

        Runs safari-web-extension-converter and then:
        1. Fixes bundle identifiers
        2. Copies entitlements files
        3. Configures entitlements in project.pbxproj

        Args:
            config: Build configuration
            runner: Process runner for executing commands
            on_output: Async callback for command output

        Raises:
            BuildStepError: If conversion fails
        """
        extension_path = config.build_dir / "extension"
        xcode_dir = config.xcode_dir
        app_name = config.app.app_name
        bundle_id = config.app.bundle_id

        # Run safari-web-extension-converter
        exit_code = await runner.run(
            cmd=[
                "xcrun",
                "safari-web-extension-converter",
                str(extension_path),
                "--project-location",
                str(xcode_dir),
                "--app-name",
                app_name,
                "--bundle-identifier",
                bundle_id,
                "--force",
                "--no-prompt",
                "--no-open",
            ],
            cwd=config.project_root,
            on_output=on_output,
        )

        if exit_code != 0:
            raise BuildStepError(
                self.name,
                "Failed to convert to Xcode project",
                exit_code=exit_code,
            )

        # Fix bundle identifier (converter derives from app name, ignoring our setting)
        await on_output("Fixing bundle identifiers...\n")
        pbxproj_path = xcode_dir / app_name / f"{app_name}.xcodeproj" / "project.pbxproj"
        self._fix_bundle_identifier(pbxproj_path)

        # Copy entitlements files
        await on_output("Copying entitlements files...\n")
        entitlements_dir = config.script_dir / "entitlements"
        app_entitlements_dest = xcode_dir / app_name / "macOS (App)" / "App.entitlements"
        ext_entitlements_dest = xcode_dir / app_name / "macOS (Extension)" / "Extension.entitlements"

        shutil.copy(entitlements_dir / "app.entitlements", app_entitlements_dest)
        shutil.copy(entitlements_dir / "extension.entitlements", ext_entitlements_dest)

        # Configure entitlements in project.pbxproj
        await on_output("Configuring entitlements in Xcode project...\n")
        self._configure_entitlements(pbxproj_path)

    def _fix_bundle_identifier(self, pbxproj_path: Path) -> None:
        """Fix bundle identifier in project.pbxproj.

        The converter uses a derived bundle ID from the app name,
        so we need to fix it to our actual bundle ID.
        """
        content = pbxproj_path.read_text()
        # Replace the wrong bundle ID with the correct one
        content = content.replace(
            "com.getstreamkeys.Stream-Keys",
            "com.getstreamkeys.StreamKeys",
        )
        pbxproj_path.write_text(content)

    def _configure_entitlements(self, pbxproj_path: Path) -> None:
        """Configure entitlements in project.pbxproj.

        Adds CODE_SIGN_ENTITLEMENTS entries using INFOPLIST_FILE as anchor.
        """
        content = pbxproj_path.read_text()

        # Add CODE_SIGN_ENTITLEMENTS for macOS App target
        content = content.replace(
            'INFOPLIST_FILE = "macOS (App)/Info.plist";',
            'CODE_SIGN_ENTITLEMENTS = "macOS (App)/App.entitlements";\n\t\t\t\tINFOPLIST_FILE = "macOS (App)/Info.plist";',
        )

        # Add CODE_SIGN_ENTITLEMENTS for macOS Extension target
        content = content.replace(
            'INFOPLIST_FILE = "macOS (Extension)/Info.plist";',
            'CODE_SIGN_ENTITLEMENTS = "macOS (Extension)/Extension.entitlements";\n\t\t\t\tINFOPLIST_FILE = "macOS (Extension)/Info.plist";',
        )

        pbxproj_path.write_text(content)

    def should_run(self, config: BuildConfig) -> bool:
        """Run for all build types except rebuild-dmg."""
        return config.build_type != "rebuild-dmg"


class XcodeBuildStep(BuildStep):
    """Build app with Xcode."""

    def __init__(self) -> None:
        """Initialize the Xcode build step."""
        super().__init__("Building app with Xcode...")

    async def execute(
        self,
        config: BuildConfig,
        runner: ProcessRunner,
        on_output: Callable[[str], Awaitable[None]],
    ) -> None:
        """Build app with Xcode.

        Uses different code signing settings based on build type and signed flag.

        Args:
            config: Build configuration
            runner: Process runner for executing commands
            on_output: Async callback for command output

        Raises:
            BuildStepError: If Xcode build fails
        """
        app_name = config.app.app_name
        xcode_project_dir = config.xcode_dir / app_name

        # Build base command
        cmd = [
            "xcodebuild",
            "-scheme",
            f"{app_name} (macOS)",
            "-configuration",
            "Release",
            "-derivedDataPath",
            "../DerivedData",
        ]

        if config.signed:
            cmd.extend([
                f"CODE_SIGN_IDENTITY={config.code_sign_identity}",
                "CODE_SIGN_STYLE=Manual",
                f"DEVELOPMENT_TEAM={config.developer.team_id}",
                "CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO",
                "OTHER_CODE_SIGN_FLAGS=--timestamp --options=runtime",
            ])
        else:
            cmd.extend([
                f"CODE_SIGN_IDENTITY={config.code_sign_identity}",
            ])

        # Update step name to show signing identity
        identity_display = config.code_sign_identity if config.code_sign_identity != "-" else "ad-hoc"
        await on_output(f"Building with Xcode ({identity_display})...\n")

        exit_code = await runner.run(
            cmd=cmd,
            cwd=xcode_project_dir,
            on_output=on_output,
        )

        if exit_code != 0:
            raise BuildStepError(
                self.name,
                "Failed to build with Xcode",
                exit_code=exit_code,
            )

    def should_run(self, config: BuildConfig) -> bool:
        """Run for all build types except rebuild-dmg."""
        return config.build_type != "rebuild-dmg"
