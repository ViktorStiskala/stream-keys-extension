"""Configuration management for Safari build tool.

Loads configuration from:
- pyproject.toml: App metadata (name, bundle ID, DMG settings)
- Environment variables: Developer identity (for local .env and CI)
"""

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import tomllib
from dotenv import load_dotenv


@dataclass(frozen=True)
class DMGConfig:
    """DMG appearance and layout configuration."""

    title: str
    icon: Path
    background: Path
    icon_size: int
    text_size: int
    window_position: tuple[int, int]
    window_size: tuple[int, int]
    app_position: tuple[int, int]
    applications_position: tuple[int, int]
    show_pathbar: bool = False
    show_status_bar: bool = False
    show_sidebar: bool = False
    show_toolbar: bool = False
    hide_extensions: list[str] | None = None


@dataclass(frozen=True)
class DeveloperConfig:
    """Developer-specific configuration from environment variables.

    These values are sensitive/personal and loaded from:
    - Local: .env file in apps/extension/
    - CI: GitHub Actions environment variables
    """

    name: str
    team_id: str
    apple_id: str | None = None
    app_specific_password: str | None = None

    @classmethod
    def from_env(cls) -> "DeveloperConfig":
        """Load from environment (works for both .env and CI)."""
        return cls(
            name=os.environ.get("APPLE_DEVELOPER_NAME", ""),
            team_id=os.environ.get("APPLE_TEAM_ID", ""),
            apple_id=os.environ.get("APPLE_ID"),
            app_specific_password=os.environ.get("APPLE_APP_SPECIFIC_PASSWORD"),
        )

    @property
    def developer_id_app(self) -> str:
        """Developer ID Application certificate name."""
        return f"Developer ID Application: {self.name} ({self.team_id})"

    @property
    def apple_distribution(self) -> str:
        """Apple Distribution certificate name."""
        return f"Apple Distribution: {self.name} ({self.team_id})"

    @property
    def installer_cert(self) -> str:
        """3rd Party Mac Developer Installer certificate name."""
        return f"3rd Party Mac Developer Installer: {self.name} ({self.team_id})"

    def validate_for_signing(self) -> list[str]:
        """Validate configuration for signed builds. Returns list of missing vars."""
        missing: list[str] = []
        if not self.name:
            missing.append("APPLE_DEVELOPER_NAME")
        if not self.team_id:
            missing.append("APPLE_TEAM_ID")
        return missing

    def validate_for_notarization(self) -> list[str]:
        """Validate configuration for notarization. Returns list of missing vars."""
        missing = self.validate_for_signing()
        if not self.apple_id:
            missing.append("APPLE_ID")
        if not self.app_specific_password:
            missing.append("APPLE_APP_SPECIFIC_PASSWORD")
        return missing


@dataclass(frozen=True)
class AppConfig:
    """App metadata from pyproject.toml."""

    app_name: str
    bundle_id: str
    build_dir: Path
    dmg: DMGConfig
    max_log_files: int = 5

    @classmethod
    def from_pyproject(cls, script_dir: Path) -> "AppConfig":
        """Load configuration from pyproject.toml."""
        pyproject_path = script_dir / "pyproject.toml"
        with open(pyproject_path, "rb") as f:
            data = tomllib.load(f)

        config = data["tool"]["build-safari"]
        dmg = config["dmg"]

        return cls(
            app_name=config["app_name"],
            bundle_id=config["bundle_id"],
            build_dir=Path(config["build_dir"]),
            max_log_files=config.get("max_log_files", 5),
            dmg=DMGConfig(
                title=dmg["title"],
                icon=Path(dmg["icon"]),
                background=Path(dmg["background"]),
                icon_size=dmg["icon_size"],
                text_size=dmg.get("text_size", 12),
                window_position=tuple(dmg["window_position"]),
                window_size=tuple(dmg["window_size"]),
                app_position=tuple(dmg["app_position"]),
                applications_position=tuple(dmg["applications_position"]),
                show_pathbar=dmg.get("show_pathbar", False),
                show_status_bar=dmg.get("show_status_bar", False),
                show_sidebar=dmg.get("show_sidebar", False),
                show_toolbar=dmg.get("show_toolbar", False),
                hide_extensions=dmg.get("hide_extensions"),
            ),
        )


@dataclass(frozen=True)
class BuildConfig:
    """Runtime configuration combining AppConfig + CLI args."""

    app: AppConfig
    developer: DeveloperConfig
    build_type: Literal["dmg", "rebuild-dmg", "appstore"]
    signed: bool
    project_root: Path
    script_dir: Path

    @property
    def build_dir(self) -> Path:
        """Full path to build output directory."""
        return self.project_root / self.app.build_dir

    @property
    def xcode_dir(self) -> Path:
        """Full path to Xcode project directory."""
        return self.build_dir / "xcode"

    @property
    def app_path(self) -> Path:
        """Full path to built .app bundle."""
        return (
            self.xcode_dir
            / "DerivedData"
            / "Build"
            / "Products"
            / "Release"
            / f"{self.app.app_name}.app"
        )

    @property
    def extension_path(self) -> Path:
        """Full path to extension .appex bundle."""
        return (
            self.app_path
            / "Contents"
            / "PlugIns"
            / f"{self.app.app_name} Extension.appex"
        )

    @property
    def output_file(self) -> str:
        """Output filename based on build type."""
        if self.build_type == "appstore":
            return "stream-keys-safari-appstore.pkg"
        return "stream-keys-safari.dmg"

    @property
    def output_path(self) -> Path:
        """Full path to output file."""
        return self.build_dir / self.output_file

    @property
    def code_sign_identity(self) -> str:
        """Code signing identity based on build type and signed flag."""
        if not self.signed:
            return "-"  # Ad-hoc signing
        if self.build_type == "appstore":
            return self.developer.apple_distribution
        return self.developer.developer_id_app

    @property
    def total_steps(self) -> int:
        """Total number of build steps based on configuration."""
        if self.build_type == "rebuild-dmg":
            return 3 if self.signed else 1
        if self.build_type == "appstore":
            return 5
        # DMG build
        return 7 if self.signed else 4

    @property
    def build_description(self) -> str:
        """Human-readable build description."""
        if self.build_type == "rebuild-dmg":
            return "Rebuild DMG (signed)" if self.signed else "Rebuild DMG (unsigned)"
        if self.build_type == "appstore":
            return "App Store Package"
        if self.signed:
            return "Signed + Notarized DMG"
        return "Local DMG (unsigned)"

    def validate(self) -> list[str]:
        """Validate configuration. Returns list of error messages."""
        errors: list[str] = []

        if self.signed:
            if self.build_type in ("dmg", "rebuild-dmg"):
                missing = self.developer.validate_for_notarization()
            else:
                missing = self.developer.validate_for_signing()

            if missing:
                errors.append(
                    f"Missing required environment variables: {', '.join(missing)}"
                )

        if self.build_type == "rebuild-dmg" and not self.app_path.exists():
            errors.append(f"App not found at {self.app_path}")

        return errors


def load_config(
    script_dir: Path,
    project_root: Path,
    build_type: Literal["dmg", "rebuild-dmg", "appstore"],
    signed: bool,
) -> BuildConfig:
    """Load all configuration - .env file for local, env vars for CI.

    Args:
        script_dir: Path to scripts/build-safari/ directory
        project_root: Path to apps/extension/ directory
        build_type: Type of build to perform
        signed: Whether to sign the build

    Returns:
        Complete BuildConfig with all settings
    """
    # Load .env file if it exists (no-op in CI where env vars are set directly)
    env_path = project_root / ".env"
    if env_path.exists():
        load_dotenv(env_path)

    app_config = AppConfig.from_pyproject(script_dir)
    developer_config = DeveloperConfig.from_env()

    return BuildConfig(
        app=app_config,
        developer=developer_config,
        build_type=build_type,
        signed=signed,
        project_root=project_root,
        script_dir=script_dir,
    )
