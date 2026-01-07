"""Terminal control sequence handling for TUI output.

Command output from PTY contains terminal control sequences that need
different handling depending on the output mode:

- --simple mode: Pass through unchanged (stdout is real terminal)
- TUI mode: Process sequences (RichLog is text widget, not terminal emulator)
- Terminal restoration: Pass through unchanged (printing to real terminal)
"""


class OutputProcessor:
    """Process terminal output for display in Textual RichLog.

    Handles carriage returns and backspaces by simulating line overwrite.
    Preserves ANSI color sequences (RichLog renders these natively).

    This processor is only used in TUI mode. In --simple mode and during
    terminal restoration, output is passed through unchanged.
    """

    def __init__(self) -> None:
        """Initialize the output processor."""
        self.current_line: str = ""

    def process(self, text: str) -> str:
        """Process raw PTY output for RichLog display.

        Handles:
        - \\r (carriage return): Reset to start of current line
        - \\n (newline): Emit current line and reset
        - \\b (backspace): Remove last char from current line

        ANSI color sequences are preserved for RichLog rendering.

        Args:
            text: Raw output from PTY

        Returns:
            Processed output suitable for RichLog (completed lines only)
        """
        result_lines: list[str] = []

        i = 0
        while i < len(text):
            char = text[i]

            if char == "\r":
                # Carriage return: reset to start of current line
                # Check for \r\n (Windows-style newline)
                if i + 1 < len(text) and text[i + 1] == "\n":
                    # Treat \r\n as newline
                    result_lines.append(self.current_line)
                    self.current_line = ""
                    i += 2
                    continue
                # Otherwise, just reset to start of line (for progress bars)
                self.current_line = ""
            elif char == "\n":
                # Newline: emit current line and reset
                result_lines.append(self.current_line)
                self.current_line = ""
            elif char == "\b":
                # Backspace: remove last char from current line
                if self.current_line:
                    self.current_line = self.current_line[:-1]
            else:
                self.current_line += char

            i += 1

        # Return completed lines joined
        if result_lines:
            return "\n".join(result_lines) + "\n"
        return ""

    def flush(self) -> str:
        """Flush any remaining partial line.

        Call this when the process ends to get any remaining output
        that hasn't been terminated with a newline.

        Returns:
            Remaining partial line (with newline appended) or empty string
        """
        if self.current_line:
            result = self.current_line + "\n"
            self.current_line = ""
            return result
        return ""

    def reset(self) -> None:
        """Reset processor state for reuse."""
        self.current_line = ""
