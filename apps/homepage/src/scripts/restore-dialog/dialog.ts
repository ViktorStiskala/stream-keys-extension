// Dialog Management - Open/Close/Toggle with Fade Animations

import { DIALOG_FADE_DURATION } from "./config";
import { getIsDialogOpen, setIsDialogOpen } from "./state";
import { EVENTS } from "./events";

// ============================================================================
// DOM Helpers
// ============================================================================

function getDialogElement(): HTMLElement | null {
  return document.getElementById("restore-dialog");
}

function getHintElement(): HTMLElement | null {
  return document.getElementById("dialog-closed-hint");
}

// ============================================================================
// Dialog Operations
// ============================================================================

export function openDialog(): void {
  if (getIsDialogOpen()) return;

  setIsDialogOpen(true);
  const dialog = getDialogElement();
  const hint = getHintElement();

  if (hint) {
    hint.style.display = "none";
    hint.style.opacity = "0";
  }

  if (dialog) {
    dialog.style.display = "block";
    dialog.style.opacity = "0";
    // Force reflow - void suppresses the no-unused-expressions lint error
    void dialog.offsetHeight;
    dialog.style.transition = `opacity ${DIALOG_FADE_DURATION}ms ease-out`;
    dialog.style.opacity = "1";
  }

  // Dispatch event to trigger re-render (avoids circular dependency with positions.ts)
  window.dispatchEvent(new CustomEvent(EVENTS.HISTORY_CHANGE));
}

export function closeDialog(): void {
  if (!getIsDialogOpen()) return;

  setIsDialogOpen(false);
  const dialog = getDialogElement();
  const hint = getHintElement();

  if (dialog) {
    dialog.style.transition = `opacity ${DIALOG_FADE_DURATION}ms ease-out`;
    dialog.style.opacity = "0";
    setTimeout(() => {
      if (!getIsDialogOpen()) {
        dialog.style.display = "none";
      }
    }, DIALOG_FADE_DURATION);
  }

  if (hint) {
    hint.style.display = "flex";
    hint.style.opacity = "0";
    // Force reflow - void suppresses the no-unused-expressions lint error
    void hint.offsetHeight;
    hint.style.transition = `opacity ${DIALOG_FADE_DURATION}ms ease-out`;
    hint.style.opacity = "1";
  }
}

export function toggleDialog(): void {
  if (getIsDialogOpen()) {
    closeDialog();
  } else {
    openDialog();
  }
}

// ============================================================================
// Close Button Handler
// ============================================================================

export function initCloseButton(): void {
  const closeBtn = document.getElementById("dialog-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closeDialog();
    });
  }
}
