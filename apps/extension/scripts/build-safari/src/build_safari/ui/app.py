"""Textual TUI application for Safari build tool.

Provides a rich terminal interface with:
- Fixed header with build description
- Step progress table with status indicators
- Scrolling output log with preserved ANSI colors
- Terminal restoration on exit (prints full log to scrollback)
"""

from __future__ import annotations

from collections.abc import Callable
from typing import TYPE_CHECKING

from textual.app import App, ComposeResult
from textual.containers import Container, Vertical
from textual.widgets import DataTable, Footer, Header, RichLog, Static

from build_safari.steps.base import StepStatus
from build_safari.utils.terminal import OutputProcessor

if TYPE_CHECKING:
    from build_safari.utils.logging import BuildLogger


# ANSI color codes for terminal restoration
CYAN = "\033[0;36m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
RED = "\033[0;31m"
DIM = "\033[2m"
NC = "\033[0m"


class BuildApp(App):
    """Textual TUI for Safari extension build.

    On exit, restores terminal and prints accumulated output
    for full scrollback history.
    """

    CSS = """
    #header-container {
        height: auto;
        max-height: 50%;
    }
    
    #title {
        text-align: center;
        text-style: bold;
        padding: 1;
        background: $primary;
    }
    
    #steps-table {
        height: auto;
        max-height: 15;
        margin: 0 1;
    }
    
    #output-container {
        height: 1fr;
        margin: 0 1 1 1;
        border: solid $primary;
    }
    
    #output-log {
        height: 1fr;
    }
    """

    BINDINGS = [
        ("q", "quit", "Quit"),
        ("ctrl+c", "quit", "Quit"),
    ]

    def __init__(
        self,
        build_description: str,
        total_steps: int,
        step_names: list[str] | None = None,
        on_ready: Callable[[], None] | None = None,
        logger: BuildLogger | None = None,
    ) -> None:
        """Initialize the build app.

        Args:
            build_description: Human-readable build description
            total_steps: Total number of build steps
            step_names: Optional list of step names
            on_ready: Callback to invoke after UI is mounted and ready
            logger: Optional build logger for saving output to file
        """
        super().__init__()
        self.build_description = build_description
        self.total_steps = total_steps
        self.step_names = step_names or []
        self.step_statuses: list[StepStatus] = [StepStatus.PENDING] * total_steps
        self._on_ready = on_ready
        self.logger = logger

        # Output buffering for terminal restoration
        self.output_buffer: list[str] = []
        self.output_processor = OutputProcessor()

        # Track build result
        self.build_success = False
        
        # Track if UI is ready
        self._mounted = False

    def compose(self) -> ComposeResult:
        """Compose the UI layout."""
        yield Header()
        with Container(id="header-container"):
            yield Static(
                f"Stream Keys - Safari Extension Build ({self.build_description})",
                id="title",
            )
            yield DataTable(id="steps-table")
        with Vertical(id="output-container"):
            yield RichLog(id="output-log", highlight=True, markup=False)
        yield Footer()

    def on_mount(self) -> None:
        """Initialize the steps table on mount."""
        # Prevent double initialization
        if self._mounted:
            return
            
        table = self.query_one("#steps-table", DataTable)
        table.add_columns("Status", "Step", "Details")

        for i in range(self.total_steps):
            name = self.step_names[i] if i < len(self.step_names) else "..."
            table.add_row(
                "[dim][PENDING][/dim]",
                f"[{i + 1}/{self.total_steps}]",
                name,
                key=str(i),
            )
        
        self._mounted = True
        
        # Call ready callback after short delay to ensure UI is fully rendered
        if self._on_ready:
            self.set_timer(0.1, self._on_ready)

    async def log_output(self, text: str) -> None:
        """Log command output to RichLog and buffer.

        Processes terminal control sequences for proper display.

        Args:
            text: Raw output from PTY
        """
        # Buffer raw output for terminal restoration
        self.output_buffer.append(text)

        # Also write to log file
        if self.logger:
            self.logger.write(text)

        # Skip UI update if not mounted yet
        if not self._mounted:
            return

        # Process for RichLog display
        processed = self.output_processor.process(text)
        if processed:
            try:
                log = self.query_one("#output-log", RichLog)
                log.write(processed.rstrip("\n"))
            except Exception:
                pass

    async def log_step(self, step_num: int, total: int, name: str) -> None:
        """Log step header.

        Args:
            step_num: Current step number (1-indexed)
            total: Total number of steps
            name: Step name
        """
        # Add to output buffer for terminal restoration
        header = f"\n{CYAN}[{step_num}/{total}] {name}{NC}\n"
        self.output_buffer.append(header)

        # Write to log file (without ANSI codes)
        if self.logger:
            self.logger.write(f"\n[{step_num}/{total}] {name}\n")

        # Update step name if we have more info
        if step_num <= len(self.step_names):
            self.step_names[step_num - 1] = name

        # Update table
        await self.update_step_status(step_num, StepStatus.RUNNING)

        # Log to output using ANSI codes (if mounted)
        if self._mounted:
            try:
                log = self.query_one("#output-log", RichLog)
                log.write(f"{CYAN}[{step_num}/{total}] {name}{NC}")
            except Exception:
                pass

    async def update_step_status(self, step_num: int, status: StepStatus) -> None:
        """Update status of a step in the table.

        Args:
            step_num: Step number (1-indexed)
            status: New status
        """
        if step_num < 1 or step_num > self.total_steps:
            return

        self.step_statuses[step_num - 1] = status
        
        # Skip table update if not mounted yet
        if not self._mounted:
            return
            
        try:
            table = self.query_one("#steps-table", DataTable)
            status_text = self._format_status_markup(status)
            name = self.step_names[step_num - 1] if step_num <= len(self.step_names) else "..."

            table.update_cell(str(step_num - 1), "Status", status_text)
            table.update_cell(str(step_num - 1), "Details", name)
        except Exception:
            # Table not ready yet, ignore
            pass

    def log_success(self, message: str) -> None:
        """Log success message.

        Args:
            message: Success message
        """
        self.output_buffer.append(f"  {GREEN}✓ {message}{NC}\n")
        if self.logger:
            self.logger.write(f"  ✓ {message}\n")
        if self._mounted:
            try:
                log = self.query_one("#output-log", RichLog)
                log.write(f"  {GREEN}✓ {message}{NC}")
            except Exception:
                pass

    def log_error(self, message: str) -> None:
        """Log error message.

        Args:
            message: Error message
        """
        self.output_buffer.append(f"  {RED}✗ ERROR: {message}{NC}\n")
        if self.logger:
            self.logger.write(f"  ✗ ERROR: {message}\n")
        if self._mounted:
            try:
                log = self.query_one("#output-log", RichLog)
                log.write(f"  {RED}✗ ERROR: {message}{NC}")
            except Exception:
                pass

    def log_info(self, message: str) -> None:
        """Log info message.

        Args:
            message: Info message
        """
        self.output_buffer.append(f"{message}\n")
        if self.logger:
            self.logger.write(f"{message}\n")
        if self._mounted:
            try:
                log = self.query_one("#output-log", RichLog)
                log.write(message)
            except Exception:
                pass

    def print_summary(
        self,
        steps: list[tuple[str, StepStatus]],
        success: bool,
        output_path: str | None = None,
        build_description: str | None = None,
    ) -> None:
        """Store summary info for terminal restoration.

        The actual printing happens in on_unmount.

        Args:
            steps: List of (step_name, status) tuples
            success: Whether build succeeded
            output_path: Path to output file (if successful)
            build_description: Description of build type
        """
        self.build_success = success
        self._summary_steps = steps
        self._summary_output_path = output_path
        self._summary_build_description = build_description

        # Write summary to log file
        if self.logger:
            self.logger.write("\n=== Build Summary ===\n")
            max_len = max(len(name) for name, _ in steps) if steps else 0
            for i, (name, status) in enumerate(steps, 1):
                status_text = self._format_status_plain(status)
                self.logger.write(f"{status_text} [{i}/{len(steps)}] {name}\n")
            self.logger.write("\n")
            if success:
                self.logger.write("=== Build Complete ===\n")
                if output_path:
                    self.logger.write(f"Output: {output_path}\n")
                if build_description:
                    self.logger.write(f"Build type: {build_description}\n")
            else:
                self.logger.write("=== Build Failed ===\n")

    def on_unmount(self) -> None:
        """Called when app exits - print buffered output to terminal.

        This provides full scrollback history after the TUI exits.
        """
        # Flush any remaining output
        remaining = self.output_processor.flush()
        if remaining:
            self.output_buffer.append(remaining)

        # Print accumulated output
        for line in self.output_buffer:
            print(line, end="")

        # Print summary
        self._print_terminal_summary()

    def _print_terminal_summary(self) -> None:
        """Print build summary to terminal."""
        steps = getattr(self, "_summary_steps", [])
        success = self.build_success
        output_path = getattr(self, "_summary_output_path", None)
        build_description = getattr(self, "_summary_build_description", None)

        print()
        print(f"{CYAN}=== Build Summary ==={NC}")

        # Calculate max step name length for alignment
        max_len = max(len(name) for name, _ in steps) if steps else 0

        for i, (name, status) in enumerate(steps, 1):
            status_text = self._format_status_terminal(status)
            print(f"{status_text} [{i}/{len(steps)}] {name:<{max_len}}")

        print()

        if success:
            print(f"{GREEN}=== Build Complete ==={NC}")
            if output_path:
                print(f"Output: {output_path}")
            if build_description:
                print(f"Build type: {build_description}")
        else:
            print(f"{RED}=== Build Failed ==={NC}")

    def _format_status_markup(self, status: StepStatus) -> str:
        """Format step status with Rich markup.

        Args:
            status: Step status

        Returns:
            Formatted status string with Rich markup
        """
        match status:
            case StepStatus.SUCCESS:
                return "[green][SUCCESS][/green]"
            case StepStatus.FAILED:
                return "[red][FAILED ][/red]"
            case StepStatus.RUNNING:
                return "[yellow][RUNNING][/yellow]"
            case StepStatus.SKIPPED:
                return "[dim][SKIPPED][/dim]"
            case _:
                return "[dim][PENDING][/dim]"

    def _format_status_terminal(self, status: StepStatus) -> str:
        """Format step status with ANSI codes for terminal.

        Args:
            status: Step status

        Returns:
            Formatted status string with ANSI codes
        """
        match status:
            case StepStatus.SUCCESS:
                return f"{GREEN}[SUCCESS]{NC}"
            case StepStatus.FAILED:
                return f"{RED}[FAILED ]{NC}"
            case StepStatus.RUNNING:
                return f"{YELLOW}[RUNNING]{NC}"
            case StepStatus.SKIPPED:
                return f"{DIM}[SKIPPED]{NC}"
            case _:
                return f"{DIM}[PENDING]{NC}"

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
