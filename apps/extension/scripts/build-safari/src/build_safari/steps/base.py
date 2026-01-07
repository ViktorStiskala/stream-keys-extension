"""Base class for build steps."""

from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from build_safari.config import BuildConfig
    from build_safari.utils.process import ProcessRunner


class StepStatus(Enum):
    """Status of a build step."""

    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class StepResult:
    """Result of executing a build step."""

    step: "BuildStep"
    status: StepStatus
    error: str | None = None


class BuildStep(ABC):
    """Abstract base class for build steps.

    Each step represents a discrete operation in the build process
    (e.g., building with Vite, converting to Xcode, creating DMG).
    """

    def __init__(self, name: str) -> None:
        """Initialize the build step.

        Args:
            name: Human-readable name for the step
        """
        self.name = name
        self.status = StepStatus.PENDING

    @abstractmethod
    async def execute(
        self,
        config: "BuildConfig",
        runner: "ProcessRunner",
        on_output: Callable[[str], Awaitable[None]],
    ) -> None:
        """Execute the build step.

        Args:
            config: Build configuration
            runner: Process runner for executing commands
            on_output: Async callback for command output

        Raises:
            BuildStepError: If the step fails
        """
        ...

    def should_run(self, config: "BuildConfig") -> bool:
        """Determine if this step should run for the given config.

        Override in subclasses to conditionally skip steps.

        Args:
            config: Build configuration

        Returns:
            True if the step should run
        """
        return True


class BuildStepError(Exception):
    """Exception raised when a build step fails."""

    def __init__(self, step_name: str, message: str, exit_code: int | None = None) -> None:
        """Initialize the error.

        Args:
            step_name: Name of the failed step
            message: Error message
            exit_code: Process exit code (if applicable)
        """
        self.step_name = step_name
        self.exit_code = exit_code
        super().__init__(f"{step_name}: {message}")
