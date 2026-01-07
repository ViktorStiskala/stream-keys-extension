"""Notarization and stapling steps."""

import asyncio
import re
from collections.abc import Awaitable, Callable

from build_safari.config import BuildConfig
from build_safari.steps.base import BuildStep, BuildStepError
from build_safari.utils.process import ProcessRunner


class NotarizeStep(BuildStep):
    """Submit DMG for notarization."""

    def __init__(self) -> None:
        """Initialize the notarization step."""
        super().__init__("Submitting for notarization...")
        self.submission_id: str | None = None

    async def execute(
        self,
        config: BuildConfig,
        runner: ProcessRunner,
        on_output: Callable[[str], Awaitable[None]],
    ) -> None:
        """Submit DMG for notarization using notarytool.

        Args:
            config: Build configuration
            runner: Process runner for executing commands
            on_output: Async callback for command output

        Raises:
            BuildStepError: If notarization fails
        """
        dmg_path = config.output_path
        developer = config.developer

        # Validate notarization credentials
        if not developer.apple_id or not developer.app_specific_password:
            raise BuildStepError(
                self.name,
                "Missing APPLE_ID or APPLE_APP_SPECIFIC_PASSWORD for notarization",
            )

        # Run notarytool submit with --wait
        result = await asyncio.create_subprocess_exec(
            "xcrun",
            "notarytool",
            "submit",
            str(dmg_path),
            "--apple-id",
            developer.apple_id,
            "--password",
            developer.app_specific_password,
            "--team-id",
            developer.team_id,
            "--wait",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        stdout, _ = await result.communicate()
        output = stdout.decode()

        # Show output
        await on_output(output)

        if result.returncode != 0:
            raise BuildStepError(
                self.name,
                "Notarization failed",
                exit_code=result.returncode,
            )

        # Extract submission ID for potential log retrieval
        match = re.search(r"^\s*id:\s*(\S+)", output, re.MULTILINE)
        if match:
            self.submission_id = match.group(1)
            await on_output(f"Submission ID: {self.submission_id}\n")

        await on_output("\033[32m✓ Notarization successful\033[0m\n")

    def should_run(self, config: BuildConfig) -> bool:
        """Run only for signed DMG builds."""
        return config.signed and config.build_type in ("dmg", "rebuild-dmg")


class StapleStep(BuildStep):
    """Staple notarization ticket to DMG."""

    MAX_RETRIES = 5
    RETRY_DELAY = 15  # seconds

    def __init__(self) -> None:
        """Initialize the stapling step."""
        super().__init__("Stapling notarization ticket...")

    async def execute(
        self,
        config: BuildConfig,
        runner: ProcessRunner,
        on_output: Callable[[str], Awaitable[None]],
    ) -> None:
        """Staple notarization ticket to DMG.

        Retries multiple times as ticket propagation can take a moment.

        Args:
            config: Build configuration
            runner: Process runner for executing commands
            on_output: Async callback for command output

        Raises:
            BuildStepError: If stapling fails after all retries
        """
        dmg_path = config.output_path

        await on_output(f"Waiting {self.RETRY_DELAY}s for notarization ticket to propagate...\n")
        await asyncio.sleep(self.RETRY_DELAY)

        for attempt in range(1, self.MAX_RETRIES + 1):
            result = await asyncio.create_subprocess_exec(
                "xcrun",
                "stapler",
                "staple",
                str(dmg_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
            stdout, _ = await result.communicate()

            if result.returncode == 0:
                await on_output("\033[32m✓ Stapling successful!\033[0m\n")
                return

            if attempt < self.MAX_RETRIES:
                await on_output(
                    f"\033[33mStapling failed (attempt {attempt}/{self.MAX_RETRIES}). "
                    f"Waiting {self.RETRY_DELAY}s for ticket propagation...\033[0m\n"
                )
                await asyncio.sleep(self.RETRY_DELAY)
            else:
                await on_output(stdout.decode())
                raise BuildStepError(
                    self.name,
                    f"Stapling failed after {self.MAX_RETRIES} attempts",
                    exit_code=result.returncode,
                )

    def should_run(self, config: BuildConfig) -> bool:
        """Run only for signed DMG builds."""
        return config.signed and config.build_type in ("dmg", "rebuild-dmg")
