"""Command-line interface for Safari build tool."""

import argparse
import sys
from typing import Literal


def parse_args(args: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments.

    Args:
        args: Arguments to parse, or None to use sys.argv

    Returns:
        Parsed arguments namespace
    """
    parser = argparse.ArgumentParser(
        prog="build_safari",
        description="Build Safari extension for Stream Keys",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m build_safari --dmg           Build unsigned DMG (local testing)
  python -m build_safari --dmg --signed  Build signed + notarized DMG
  python -m build_safari --appstore      Build App Store package
  python -m build_safari --simple        Use simple output instead of TUI
        """,
    )

    # Build type (mutually exclusive)
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--dmg",
        action="store_true",
        default=True,
        help="Build DMG package (default)",
    )
    group.add_argument(
        "--rebuild-dmg",
        action="store_true",
        help="Rebuild DMG from existing app",
    )
    group.add_argument(
        "--appstore",
        action="store_true",
        help="Build App Store package",
    )

    # Signing
    parser.add_argument(
        "--signed",
        action="store_true",
        help="Sign and notarize the build",
    )

    # UI mode
    parser.add_argument(
        "--simple",
        action="store_true",
        help="Use simple output instead of TUI (colors preserved)",
    )

    # --help is provided automatically by argparse

    return parser.parse_args(args)


def get_build_type(args: argparse.Namespace) -> Literal["dmg", "rebuild-dmg", "appstore"]:
    """Determine build type from parsed arguments."""
    if args.rebuild_dmg:
        return "rebuild-dmg"
    if args.appstore:
        return "appstore"
    return "dmg"


def should_use_tui(args: argparse.Namespace) -> bool:
    """Determine whether to use Textual TUI.

    Returns False if:
    - User requested simple output (--simple)
    - Not running in a TTY (CI, piped output)
    """
    if args.simple:
        return False
    if not sys.stdout.isatty():
        return False
    return True
