"""Protocol definition for build UI."""

from typing import Protocol

from build_safari.steps.base import StepStatus


class BuildUI(Protocol):
    """Protocol for build UI implementations.

    Both BuildApp (TUI) and SimpleUI implement this protocol,
    allowing the runner to work with either transparently.
    """

    async def log_output(self, text: str) -> None:
        """Log command output.

        Args:
            text: Output text (may contain ANSI escape codes)
        """
        ...

    async def log_step(self, step_num: int, total: int, name: str) -> None:
        """Log step header.

        Args:
            step_num: Current step number (1-indexed)
            total: Total number of steps
            name: Step name
        """
        ...

    async def update_step_status(self, step_num: int, status: StepStatus) -> None:
        """Update status of a step.

        Args:
            step_num: Step number (1-indexed)
            status: New status
        """
        ...

    def log_success(self, message: str) -> None:
        """Log success message.

        Args:
            message: Success message
        """
        ...

    def log_error(self, message: str) -> None:
        """Log error message.

        Args:
            message: Error message
        """
        ...

    def log_info(self, message: str) -> None:
        """Log info message.

        Args:
            message: Info message
        """
        ...

    def print_summary(
        self,
        steps: list[tuple[str, StepStatus]],
        success: bool,
        output_path: str | None = None,
        build_description: str | None = None,
    ) -> None:
        """Print final build summary.

        Args:
            steps: List of (step_name, status) tuples
            success: Whether build succeeded
            output_path: Path to output file (if successful)
            build_description: Description of build type
        """
        ...
