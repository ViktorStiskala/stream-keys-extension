// Restore Dialog - Main Entry Point
// Full interactive demo with keyboard shortcuts, position restoration, and progress bar

import { EVENTS } from "./events";
import { getIsDialogOpen } from "./state";
import { initCloseButton, closeDialog } from "./dialog";
import { renderPositions, updateTimes } from "./positions";
import { initProgressBar } from "./progress-bar";
import { initKeyboard } from "./keyboard";
import { initVisibilityObserver } from "./visibility";

// ============================================================================
// Initialization
// ============================================================================

function init(): void {
  // Initial render
  renderPositions();

  // Update times every 300ms
  setInterval(updateTimes, 300);

  // Initial time update
  updateTimes();

  // Add keyboard listener
  initKeyboard();

  // Initialize close button
  initCloseButton();

  // Initialize progress bar
  initProgressBar();

  // Initialize visibility observer (enables keyboard shortcuts only when demo is visible)
  initVisibilityObserver();

  // Listen for history changes to re-render
  window.addEventListener(EVENTS.HISTORY_CHANGE, () => {
    if (getIsDialogOpen()) {
      renderPositions();
    }
  });

  // Listen for close dialog events (decouples positions.ts from dialog.ts)
  window.addEventListener(EVENTS.CLOSE_DIALOG, () => {
    closeDialog();
  });
}

// Run when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
