"""Vite build step for Safari extension."""

from collections.abc import Awaitable, Callable

from build_safari.config import BuildConfig
from build_safari.steps.base import BuildStep, BuildStepError
from build_safari.utils.process import ProcessRunner


class ViteBuildStep(BuildStep):
    """Build Safari extension with Vite."""

    def __init__(self) -> None:
        """Initialize the Vite build step."""
        super().__init__("Building Safari extension...")

    async def execute(
        self,
        config: BuildConfig,
        runner: ProcessRunner,
        on_output: Callable[[str], Awaitable[None]],
    ) -> None:
        """Execute Vite build.

        Runs: env BROWSER=safari npx vite build

        Args:
            config: Build configuration
            runner: Process runner for executing commands
            on_output: Async callback for command output

        Raises:
            BuildStepError: If Vite build fails
        """
        exit_code = await runner.run(
            cmd=["npx", "vite", "build"],
            cwd=config.project_root,
            env={"BROWSER": "safari"},
            on_output=on_output,
        )

        if exit_code != 0:
            raise BuildStepError(
                self.name,
                "Failed to build Safari extension",
                exit_code=exit_code,
            )

    def should_run(self, config: BuildConfig) -> bool:
        """Run for all build types except rebuild-dmg."""
        return config.build_type != "rebuild-dmg"
