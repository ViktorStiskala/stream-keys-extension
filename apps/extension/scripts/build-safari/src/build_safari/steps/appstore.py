"""App Store package creation step."""

from collections.abc import Awaitable, Callable

from build_safari.config import BuildConfig
from build_safari.steps.base import BuildStep, BuildStepError
from build_safari.utils.process import ProcessRunner


class AppStorePackageStep(BuildStep):
    """Create signed installer package for App Store."""

    def __init__(self) -> None:
        """Initialize the App Store package step."""
        super().__init__("Creating signed installer package...")

    async def execute(
        self,
        config: BuildConfig,
        runner: ProcessRunner,
        on_output: Callable[[str], Awaitable[None]],
    ) -> None:
        """Create signed installer package for App Store.

        Uses productbuild to create a .pkg file.

        Args:
            config: Build configuration
            runner: Process runner for executing commands
            on_output: Async callback for command output

        Raises:
            BuildStepError: If package creation fails
        """
        app_path = config.app_path
        output_path = config.output_path
        installer_cert = config.developer.installer_cert

        await on_output(f"Creating package with installer certificate: {installer_cert}\n")

        exit_code = await runner.run(
            cmd=[
                "productbuild",
                "--component",
                str(app_path),
                "/Applications",
                "--sign",
                installer_cert,
                str(output_path),
            ],
            cwd=config.build_dir,
            on_output=on_output,
        )

        if exit_code != 0:
            raise BuildStepError(
                self.name,
                "Failed to create installer package",
                exit_code=exit_code,
            )

        await on_output(f"\033[32m✓ Package created: {output_path}\033[0m\n")
        await on_output(
            "\n\033[36mNote: App Store packages are not notarized - "
            "Apple handles this during review.\033[0m\n"
        )

    def should_run(self, config: BuildConfig) -> bool:
        """Run only for appstore build type."""
        return config.build_type == "appstore"
