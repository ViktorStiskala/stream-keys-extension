"""Build log management with rotation.

Keeps up to N build logs (configurable via pyproject.toml max_log_files):
- build.log (current/most recent)
- build.log.1 (previous)
- build.log.2, build.log.3, ... (older)
"""

from pathlib import Path

DEFAULT_MAX_LOGS = 5


def get_log_dir(script_dir: Path) -> Path:
    """Get the log directory path.

    Args:
        script_dir: Path to the build-safari script directory

    Returns:
        Path to the log directory
    """
    return script_dir / "log"


def get_log_path(script_dir: Path, index: int = 0) -> Path:
    """Get path to a specific log file.

    Args:
        script_dir: Path to the build-safari script directory
        index: Log index (0 = current, 1+ = older)

    Returns:
        Path to the log file
    """
    log_dir = get_log_dir(script_dir)
    if index == 0:
        return log_dir / "build.log"
    return log_dir / f"build.log.{index}"


def rotate_logs(script_dir: Path, max_logs: int = DEFAULT_MAX_LOGS) -> None:
    """Rotate existing logs before starting a new build.

    Renames logs from oldest to newest, deleting the oldest if at limit.

    Args:
        script_dir: Path to the build-safari script directory
        max_logs: Maximum number of log files to keep
    """
    log_dir = get_log_dir(script_dir)
    log_dir.mkdir(parents=True, exist_ok=True)

    # Delete oldest log if it exists (index max_logs - 1)
    oldest = get_log_path(script_dir, max_logs - 1)
    if oldest.exists():
        oldest.unlink()

    # Rotate existing logs (from oldest to newest)
    for i in range(max_logs - 2, -1, -1):
        current = get_log_path(script_dir, i)
        if current.exists():
            next_path = get_log_path(script_dir, i + 1)
            current.rename(next_path)


class BuildLogger:
    """Collects and writes build logs."""

    def __init__(self, script_dir: Path, max_logs: int = DEFAULT_MAX_LOGS) -> None:
        """Initialize the build logger.

        Args:
            script_dir: Path to the build-safari script directory
            max_logs: Maximum number of log files to keep
        """
        self.script_dir = script_dir
        self.max_logs = max_logs
        self.log_path = get_log_path(script_dir)
        self.buffer: list[str] = []
        self._file_handle = None

    def start(self) -> None:
        """Start logging - rotate logs and open new log file."""
        rotate_logs(self.script_dir, self.max_logs)
        log_dir = get_log_dir(self.script_dir)
        log_dir.mkdir(parents=True, exist_ok=True)
        self._file_handle = open(self.log_path, "w", encoding="utf-8")

    def write(self, text: str) -> None:
        """Write text to the log.

        Args:
            text: Text to write (may contain ANSI codes)
        """
        self.buffer.append(text)
        if self._file_handle:
            # Strip ANSI codes for file output
            clean_text = self._strip_ansi(text)
            self._file_handle.write(clean_text)
            self._file_handle.flush()

    def write_line(self, text: str) -> None:
        """Write a line to the log.

        Args:
            text: Text to write (newline added if missing)
        """
        if not text.endswith("\n"):
            text = text + "\n"
        self.write(text)

    def close(self) -> None:
        """Close the log file."""
        if self._file_handle:
            self._file_handle.close()
            self._file_handle = None

    @staticmethod
    def _strip_ansi(text: str) -> str:
        """Remove ANSI escape codes from text.

        Args:
            text: Text possibly containing ANSI codes

        Returns:
            Text with ANSI codes removed
        """
        import re

        ansi_escape = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")
        return ansi_escape.sub("", text)

    def __enter__(self) -> "BuildLogger":
        """Context manager entry."""
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Context manager exit."""
        self.close()
