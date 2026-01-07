"""Code signing verification step."""

import asyncio
import subprocess
from collections.abc import Awaitable, Callable

from build_safari.config import BuildConfig
from build_safari.steps.base import BuildStep, BuildStepError
from build_safari.utils.process import ProcessRunner


class SigningVerifyStep(BuildStep):
    """Verify code signature of built app."""

    def __init__(self) -> None:
        """Initialize the signing verification step."""
        super().__init__("Verifying code signature...")

    async def execute(
        self,
        config: BuildConfig,
        runner: ProcessRunner,
        on_output: Callable[[str], Awaitable[None]],
    ) -> None:
        """Verify code signature of the built app.

        Checks:
        1. App signature is valid
        2. Signed by correct identity
        3. Hardened runtime is enabled
        4. Secure timestamp is present
        5. No debug entitlement (get-task-allow)
        6. Extension signature is valid

        Args:
            config: Build configuration
            runner: Process runner for executing commands
            on_output: Async callback for command output

        Raises:
            BuildStepError: If verification fails
        """
        app_path = config.app_path
        extension_path = config.extension_path
        developer_name = config.developer.name

        # Check app signature
        await on_output("  Checking app signature...\n")
        result = await asyncio.create_subprocess_exec(
            "codesign",
            "--verify",
            "--deep",
            "--strict",
            "--verbose=2",
            str(app_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        stdout, _ = await result.communicate()
        if result.returncode != 0:
            raise BuildStepError(
                self.name,
                f"App signature verification failed:\n{stdout.decode()}",
                exit_code=result.returncode,
            )

        # Get detailed codesign info
        result = await asyncio.create_subprocess_exec(
            "codesign",
            "-dv",
            "--verbose=4",
            str(app_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        stdout, _ = await result.communicate()
        codesign_info = stdout.decode()

        # Check signing identity
        await on_output("  Checking signing identity...\n")
        signing_authority = None
        for line in codesign_info.split("\n"):
            if line.startswith("Authority="):
                signing_authority = line.replace("Authority=", "")
                break

        if signing_authority and developer_name in signing_authority:
            await on_output(f"  \033[32m✓ Signed by {signing_authority}\033[0m\n")
        else:
            raise BuildStepError(
                self.name,
                f"Wrong signing identity: {signing_authority} (expected {developer_name})",
            )

        # Check for hardened runtime and timestamp
        await on_output("  Checking for hardened runtime and timestamp...\n")
        if "flags=" in codesign_info and "runtime" in codesign_info:
            await on_output("  \033[32m✓ Hardened runtime enabled\033[0m\n")
        else:
            raise BuildStepError(self.name, "Hardened runtime not enabled")

        if "Timestamp=" in codesign_info:
            await on_output("  \033[32m✓ Secure timestamp present\033[0m\n")
        else:
            raise BuildStepError(self.name, "Secure timestamp missing")

        # Check for debug entitlement
        await on_output("  Checking entitlements (no debug entitlement)...\n")
        result = await asyncio.create_subprocess_exec(
            "codesign",
            "-d",
            "--entitlements",
            "-",
            str(app_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        stdout, _ = await result.communicate()
        entitlements = stdout.decode()

        if "get-task-allow" in entitlements:
            raise BuildStepError(
                self.name,
                "Debug entitlement 'get-task-allow' found - will fail notarization",
            )
        await on_output("  \033[32m✓ No debug entitlement\033[0m\n")

        # Check extension signature
        await on_output("  Checking extension signature...\n")
        result = await asyncio.create_subprocess_exec(
            "codesign",
            "--verify",
            "--deep",
            "--strict",
            str(extension_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        _, _ = await result.communicate()
        if result.returncode != 0:
            raise BuildStepError(
                self.name,
                "Extension signature verification failed",
                exit_code=result.returncode,
            )
        await on_output("  \033[32m✓ Extension signature valid\033[0m\n")

        await on_output("\033[32m✓ All signature checks passed!\033[0m\n")

    def should_run(self, config: BuildConfig) -> bool:
        """Run only for signed builds (not rebuild-dmg)."""
        return config.signed and config.build_type != "rebuild-dmg"


class RebuildDMGVerifyStep(BuildStep):
    """Verify existing app signature for rebuild-dmg."""

    def __init__(self) -> None:
        """Initialize the rebuild verification step."""
        super().__init__("Verifying existing code signature...")

    async def execute(
        self,
        config: BuildConfig,
        runner: ProcessRunner,
        on_output: Callable[[str], Awaitable[None]],
    ) -> None:
        """Verify existing app is properly signed for rebuild-dmg.

        Args:
            config: Build configuration
            runner: Process runner for executing commands
            on_output: Async callback for command output

        Raises:
            BuildStepError: If verification fails
        """
        app_path = config.app_path
        developer_name = config.developer.name

        # Verify code signature exists and is valid
        result = await asyncio.create_subprocess_exec(
            "codesign",
            "--verify",
            "--deep",
            "--strict",
            str(app_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        _, _ = await result.communicate()
        if result.returncode != 0:
            raise BuildStepError(
                self.name,
                "Code signature verification failed for existing build. "
                "Run with --dmg --signed instead to perform a full signed build.",
                exit_code=result.returncode,
            )

        # Check signing identity
        result = await asyncio.create_subprocess_exec(
            "codesign",
            "-dv",
            "--verbose=4",
            str(app_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        stdout, _ = await result.communicate()
        codesign_info = stdout.decode()

        # Check for correct identity
        signing_authority = None
        for line in codesign_info.split("\n"):
            if line.startswith("Authority="):
                signing_authority = line.replace("Authority=", "")
                break

        if signing_authority and developer_name not in signing_authority:
            raise BuildStepError(
                self.name,
                f"Existing build was signed with wrong identity: {signing_authority}. "
                "Run with --dmg --signed instead to perform a full signed build.",
            )

        # Check for hardened runtime
        if "flags=" not in codesign_info or "runtime" not in codesign_info:
            raise BuildStepError(
                self.name,
                "Existing build does not have hardened runtime enabled. "
                "This is required for notarization. "
                "Run with --dmg --signed instead to perform a full signed build.",
            )

        await on_output(f"\033[32m✓ Existing build signature verified: {signing_authority}\033[0m\n")

    def should_run(self, config: BuildConfig) -> bool:
        """Run only for signed rebuild-dmg builds."""
        return config.signed and config.build_type == "rebuild-dmg"
