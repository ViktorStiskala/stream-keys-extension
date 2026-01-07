"""Simple colored output UI for --simple mode and CI."""

from __future__ import annotations

import sys
from typing import TYPE_CHECKING

from build_safari.steps.base import StepStatus

if TYPE_CHECKING:
    from build_safari.utils.logging import BuildLogger


# ANSI color codes
BLUE = "\033[0;34m"
CYAN = "\033[0;36m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
RED = "\033[0;31m"
DIM = "\033[2m"
BOLD = "\033[1m"
NC = "\033[0m"  # No color


class SimpleUI:
    """Non-TUI output handler with colored step headers.

    Used for:
    - --simple mode (TTY with colors)
    - CI mode (non-TTY, no colors)

    Colors are only output when stdout is a TTY.
    """

    def __init__(self, logger: BuildLogger | None = None) -> None:
        """Initialize the simple UI.

        Args:
            logger: Optional build logger for saving output to file
        """
        self.is_tty = sys.stdout.isatty()
        self.step_statuses: list[tuple[str, StepStatus]] = []
        self.logger = logger

    def _color(self, code: str) -> str:
        """Return color code if TTY, empty string otherwise."""
        return code if self.is_tty else ""

    def _log_to_file(self, text: str) -> None:
        """Write text to log file if logger is available.

        Args:
            text: Text to log
        """
        if self.logger:
            self.logger.write(text)

    async def log_output(self, text: str) -> None:
        """Print output directly to stdout (preserves ANSI from PTY).

        Args:
            text: Output text
        """
        print(text, end="", flush=True)
        self._log_to_file(text)

    async def log_step(self, step_num: int, total: int, name: str) -> None:
        """Print colored step header.

        Args:
            step_num: Current step number (1-indexed)
            total: Total number of steps
            name: Step name
        """
        print()  # Blank line before step
        line = f"{self._color(CYAN)}[{step_num}/{total}] {name}{self._color(NC)}"
        print(line)
        self._log_to_file(f"\n[{step_num}/{total}] {name}\n")
        self.step_statuses.append((name, StepStatus.RUNNING))

    async def update_step_status(self, step_num: int, status: StepStatus) -> None:
        """Update status of a step.

        Args:
            step_num: Step number (1-indexed)
            status: New status
        """
        if 0 < step_num <= len(self.step_statuses):
            name = self.step_statuses[step_num - 1][0]
            self.step_statuses[step_num - 1] = (name, status)

    def log_success(self, message: str) -> None:
        """Print success message.

        Args:
            message: Success message
        """
        line = f"  {self._color(GREEN)}✓ {message}{self._color(NC)}"
        print(line)
        self._log_to_file(f"  ✓ {message}\n")

    def log_error(self, message: str) -> None:
        """Print error message.

        Args:
            message: Error message
        """
        line = f"  {self._color(RED)}✗ ERROR: {message}{self._color(NC)}"
        print(line)
        self._log_to_file(f"  ✗ ERROR: {message}\n")

    def log_info(self, message: str) -> None:
        """Print info message.

        Args:
            message: Info message
        """
        line = f"{self._color(BLUE)}{message}{self._color(NC)}"
        print(line)
        self._log_to_file(f"{message}\n")

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
        print()
        print(f"{self._color(CYAN)}=== Build Summary ==={self._color(NC)}")
        self._log_to_file("\n=== Build Summary ===\n")

        # Calculate max step name length for alignment
        max_len = max(len(name) for name, _ in steps) if steps else 0

        for i, (name, status) in enumerate(steps, 1):
            status_text = self._format_status(status)
            status_plain = self._format_status_plain(status)
            print(f"{status_text} [{i}/{len(steps)}] {name:<{max_len}}")
            self._log_to_file(f"{status_plain} [{i}/{len(steps)}] {name}\n")

        print()
        self._log_to_file("\n")

        if success:
            print(f"{self._color(GREEN)}=== Build Complete ==={self._color(NC)}")
            self._log_to_file("=== Build Complete ===\n")
            if output_path:
                print(f"{self._color(BLUE)}Output: {output_path}{self._color(NC)}")
                self._log_to_file(f"Output: {output_path}\n")
            if build_description:
                print(f"{self._color(BLUE)}Build type: {build_description}{self._color(NC)}")
                self._log_to_file(f"Build type: {build_description}\n")
        else:
            print(f"{self._color(RED)}=== Build Failed ==={self._color(NC)}")
            self._log_to_file("=== Build Failed ===\n")

    def _format_status(self, status: StepStatus) -> str:
        """Format step status with color.

        Args:
            status: Step status

        Returns:
            Formatted status string
        """
        match status:
            case StepStatus.SUCCESS:
                return f"{self._color(GREEN)}[SUCCESS]{self._color(NC)}"
            case StepStatus.FAILED:
                return f"{self._color(RED)}[FAILED ]{self._color(NC)}"
            case StepStatus.RUNNING:
                return f"{self._color(YELLOW)}[RUNNING]{self._color(NC)}"
            case StepStatus.SKIPPED:
                return f"{self._color(DIM)}[SKIPPED]{self._color(NC)}"
            case _:
                return f"{self._color(DIM)}[PENDING]{self._color(NC)}"

    def _format_status_plain(self, status: StepStatus) -> str:
        """Format step status without colors (for log file).

        Args:
            status: Step status

        Returns:
            Plain text status string
        """
        match status:
            case StepStatus.SUCCESS:
                return "[SUCCESS]"
            case StepStatus.FAILED:
                return "[FAILED ]"
            case StepStatus.RUNNING:
                return "[RUNNING]"
            case StepStatus.SKIPPED:
                return "[SKIPPED]"
            case _:
                return "[PENDING]"
