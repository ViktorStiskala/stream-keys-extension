"""Entry point for Safari build tool.

Usage:
    python -m build_safari --dmg           Build unsigned DMG
    python -m build_safari --dmg --signed  Build signed + notarized DMG
    python -m build_safari --appstore      Build App Store package
    python -m build_safari --simple        Use simple output instead of TUI
"""

import asyncio
import sys
from pathlib import Path

from build_safari.cli import get_build_type, parse_args, should_use_tui
from build_safari.config import load_config
from build_safari.runner import get_steps, run_build
from build_safari.utils.logging import BuildLogger


def main() -> int:
    """Main entry point.

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    args = parse_args()

    # Resolve paths
    # __main__.py is in src/build_safari/, script_dir is build-safari/
    script_dir = Path(__file__).parent.parent.parent.resolve()
    # project_root is apps/extension/
    project_root = script_dir.parent.parent.resolve()

    # Load configuration
    build_type = get_build_type(args)
    signed = args.signed or build_type == "appstore"  # appstore is always signed

    try:
        config = load_config(script_dir, project_root, build_type, signed)
    except Exception as e:
        print(f"\033[31mError loading configuration: {e}\033[0m", file=sys.stderr)
        return 1

    # Validate configuration
    errors = config.validate()
    if errors:
        print("\033[31mConfiguration errors:\033[0m", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    # Initialize build logger (rotates previous logs)
    logger = BuildLogger(script_dir, max_logs=config.app.max_log_files)

    # Determine UI mode
    use_tui = should_use_tui(args)

    if use_tui:
        return run_with_tui(config, logger)
    else:
        return run_with_simple_ui(config, logger)


def run_with_tui(config, logger: BuildLogger) -> int:
    """Run build with Textual TUI.

    Args:
        config: Build configuration
        logger: Build logger for saving output to file

    Returns:
        Exit code
    """
    from build_safari.ui.app import BuildApp

    steps = get_steps(config)
    step_names = [step.name for step in steps]

    # Store result for after app exits
    result = {"success": False}

    # Will be set once app is created
    app: BuildApp | None = None

    # Start logging
    logger.start()
    logger.write_line(f"=== Building Safari Extension ({config.build_description}) ===\n")

    def start_build() -> None:
        """Start the build process when UI is ready."""
        asyncio.create_task(do_build())

    async def do_build() -> None:
        """Run build and exit when done."""
        nonlocal app
        if app is None:
            return
        try:
            result["success"] = await run_build(config, app, use_pty=True)
        except Exception as e:
            app.log_error(f"Build failed: {e}")
            result["success"] = False
        finally:
            app.exit()

    app = BuildApp(
        build_description=config.build_description,
        total_steps=len(steps),
        step_names=step_names,
        on_ready=start_build,
        logger=logger,
    )

    app.run()

    # Close logger after app exits
    logger.close()

    return 0 if result["success"] else 1


def run_with_simple_ui(config, logger: BuildLogger) -> int:
    """Run build with simple colored output.

    Args:
        config: Build configuration
        logger: Build logger for saving output to file

    Returns:
        Exit code
    """
    from build_safari.ui.simple import SimpleUI

    # Start logging
    logger.start()

    ui = SimpleUI(logger=logger)

    # Print header
    header = f"\033[32m=== Building Safari Extension ({config.build_description}) ===\033[0m"
    print(header)
    logger.write_line(header)

    # Run build
    success = asyncio.run(run_build(config, ui, use_pty=sys.stdout.isatty()))

    # Close logger
    logger.close()

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
