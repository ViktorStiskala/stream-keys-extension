"""Build runner that orchestrates build steps."""

from build_safari.config import BuildConfig
from build_safari.steps.appstore import AppStorePackageStep
from build_safari.steps.base import BuildStep, BuildStepError, StepStatus
from build_safari.steps.dmg import DMGCreateStep
from build_safari.steps.notarize import NotarizeStep, StapleStep
from build_safari.steps.signing import RebuildDMGVerifyStep, SigningVerifyStep
from build_safari.steps.vite import ViteBuildStep
from build_safari.steps.xcode import XcodeBuildStep, XcodeConvertStep
from build_safari.ui.protocol import BuildUI
from build_safari.utils.process import ProcessRunner


def get_steps(config: BuildConfig) -> list[BuildStep]:
    """Get list of build steps for the given configuration.

    Args:
        config: Build configuration

    Returns:
        List of steps to execute
    """
    # All possible steps in order
    all_steps: list[BuildStep] = [
        ViteBuildStep(),
        XcodeConvertStep(),
        XcodeBuildStep(),
        RebuildDMGVerifyStep(),  # Only for rebuild-dmg --signed
        SigningVerifyStep(),  # Only for signed builds (not rebuild-dmg)
        DMGCreateStep(),
        NotarizeStep(),
        StapleStep(),
        AppStorePackageStep(),
    ]

    # Filter to only steps that should run for this config
    return [step for step in all_steps if step.should_run(config)]


async def run_build(config: BuildConfig, ui: BuildUI, use_pty: bool = True) -> bool:
    """Run the complete build process.

    Args:
        config: Build configuration
        ui: UI for output and status updates
        use_pty: Whether to use PTY for subprocess execution

    Returns:
        True if build succeeded, False otherwise
    """
    steps = get_steps(config)
    runner = ProcessRunner(use_pty=use_pty)

    step_results: list[tuple[str, StepStatus]] = []
    current_step = 0
    success = True

    try:
        for i, step in enumerate(steps, 1):
            current_step = i
            step.status = StepStatus.RUNNING

            await ui.log_step(i, len(steps), step.name)
            await ui.update_step_status(i, StepStatus.RUNNING)

            try:
                await step.execute(config, runner, ui.log_output)
                step.status = StepStatus.SUCCESS
                await ui.update_step_status(i, StepStatus.SUCCESS)
                step_results.append((step.name, StepStatus.SUCCESS))

            except BuildStepError as e:
                step.status = StepStatus.FAILED
                await ui.update_step_status(i, StepStatus.FAILED)
                ui.log_error(str(e))
                step_results.append((step.name, StepStatus.FAILED))
                success = False
                break

        # Mark remaining steps as pending (not reached)
        for step in steps[current_step:]:
            step_results.append((step.name, StepStatus.PENDING))

    except Exception as e:
        ui.log_error(f"Unexpected error: {e}")
        success = False
        # Mark current step as failed
        if current_step > 0 and current_step <= len(steps):
            steps[current_step - 1].status = StepStatus.FAILED
            await ui.update_step_status(current_step, StepStatus.FAILED)
            if len(step_results) < current_step:
                step_results.append((steps[current_step - 1].name, StepStatus.FAILED))
            else:
                step_results[current_step - 1] = (
                    steps[current_step - 1].name,
                    StepStatus.FAILED,
                )

    # Print summary
    ui.print_summary(
        steps=step_results,
        success=success,
        output_path=str(config.output_path) if success else None,
        build_description=config.build_description,
    )

    return success
