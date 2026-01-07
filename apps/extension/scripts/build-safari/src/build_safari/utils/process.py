"""Asynchronous subprocess execution with PTY support for color preservation.

Many CLI tools (vite, xcodebuild, npm) check isatty() to decide whether to
output ANSI colors. To preserve colors, we use a pseudo-terminal (PTY) via
Python's built-in pty module.
"""

import asyncio
import fcntl
import os
import pty
import struct
import sys
import termios
from collections.abc import Awaitable, Callable
from pathlib import Path


class ProcessRunner:
    """Async subprocess runner with optional PTY for color preservation.

    When use_pty=True and running in a TTY, subprocesses are run through a PTY
    so they think they're connected to a real terminal and output colors.
    """

    def __init__(self, use_pty: bool = True) -> None:
        """Initialize the process runner.

        Args:
            use_pty: Whether to use PTY (only effective if parent is TTY)
        """
        self.use_pty = use_pty and sys.stdout.isatty()

    async def run(
        self,
        cmd: list[str],
        cwd: Path,
        env: dict[str, str] | None = None,
        on_output: Callable[[str], Awaitable[None]] | None = None,
    ) -> int:
        """Run command asynchronously, streaming output via async callback.

        Args:
            cmd: Command and arguments to run
            cwd: Working directory for the command
            env: Environment variables (uses current env if None)
            on_output: Async callback for output chunks

        Returns:
            Process exit code
        """
        if self.use_pty:
            return await self._run_with_pty(cmd, cwd, env, on_output)
        return await self._run_simple(cmd, cwd, env, on_output)

    async def _run_with_pty(
        self,
        cmd: list[str],
        cwd: Path,
        env: dict[str, str] | None,
        on_output: Callable[[str], Awaitable[None]] | None,
    ) -> int:
        """Run with PTY for color preservation."""
        master_fd, slave_fd = pty.openpty()

        # Set terminal size on PTY (helps tools that check terminal width)
        size = struct.pack("HHHH", 24, 120, 0, 0)  # rows, cols, xpixel, ypixel
        fcntl.ioctl(master_fd, termios.TIOCSWINSZ, size)

        # Merge env with current environment if provided
        full_env = os.environ.copy()
        if env:
            full_env.update(env)

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            cwd=cwd,
            env=full_env,
        )
        os.close(slave_fd)  # Close slave in parent process

        # Read from master_fd asynchronously
        await self._read_fd_async(master_fd, on_output)

        os.close(master_fd)
        await process.wait()
        return process.returncode or 0

    async def _run_simple(
        self,
        cmd: list[str],
        cwd: Path,
        env: dict[str, str] | None,
        on_output: Callable[[str], Awaitable[None]] | None,
    ) -> int:
        """Non-PTY execution using native asyncio streams."""
        # Merge env with current environment if provided
        full_env = os.environ.copy()
        if env:
            full_env.update(env)

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=cwd,
            env=full_env,
        )

        if process.stdout and on_output:
            async for line in process.stdout:
                await on_output(line.decode("utf-8", errors="replace"))

        await process.wait()
        return process.returncode or 0

    async def _read_fd_async(
        self,
        fd: int,
        on_output: Callable[[str], Awaitable[None]] | None,
    ) -> None:
        """Read from file descriptor asynchronously using executor.

        File descriptor operations aren't async-native, so we use
        run_in_executor to avoid blocking the event loop.
        """
        loop = asyncio.get_running_loop()
        while True:
            try:
                data = await loop.run_in_executor(None, os.read, fd, 4096)
                if not data:
                    break
                if on_output:
                    await on_output(data.decode("utf-8", errors="replace"))
            except OSError:
                # PTY closed or process ended
                break


async def run_command(
    cmd: list[str],
    cwd: Path,
    env: dict[str, str] | None = None,
    on_output: Callable[[str], Awaitable[None]] | None = None,
    use_pty: bool = True,
) -> int:
    """Convenience function to run a command.

    Args:
        cmd: Command and arguments to run
        cwd: Working directory for the command
        env: Additional environment variables
        on_output: Async callback for output chunks
        use_pty: Whether to use PTY for color preservation

    Returns:
        Process exit code
    """
    runner = ProcessRunner(use_pty=use_pty)
    return await runner.run(cmd, cwd, env, on_output)
