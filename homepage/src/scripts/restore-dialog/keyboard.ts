// Keyboard Event Handlers

import { getIsDialogOpen } from "./state";
import { toggleDialog, closeDialog } from "./dialog";
import { saveCurrentPosition, selectPositionByKey } from "./positions";
import { getIsDemoVisible } from "./visibility";

// ============================================================================
// Keyboard Handler
// ============================================================================

function handleKeydown(e: KeyboardEvent): void {
  // Only handle shortcuts when demo section is visible
  if (!getIsDemoVisible()) return;

  // Skip if user is typing in an input field
  const target = e.target as HTMLElement;
  if (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  ) {
    return;
  }

  // Check for modifier keys
  if (e.ctrlKey || e.metaKey || e.altKey) {
    return;
  }

  const key = e.key.toLowerCase();

  // S key - save position (works always)
  if (key === "s" && !e.shiftKey) {
    e.preventDefault();
    saveCurrentPosition();
    return;
  }

  // R key - toggle dialog
  if (key === "r" && !e.shiftKey) {
    e.preventDefault();
    toggleDialog();
    return;
  }

  // Only handle these keys when dialog is open
  if (!getIsDialogOpen()) return;

  // Escape key - close dialog
  if (key === "escape") {
    e.preventDefault();
    closeDialog();
    return;
  }

  // Number keys 0-9 - select position
  if (/^[0-9]$/.test(key)) {
    e.preventDefault();
    selectPositionByKey(parseInt(key, 10));
    return;
  }
}

// ============================================================================
// Demo Key Click Handlers
// ============================================================================

// Prevent Space from activating buttons - ironic since the extension fixes this!
function preventSpaceActivation(e: KeyboardEvent): void {
  if (e.key === " " || e.key === "Spacebar") {
    e.preventDefault();
  }
}

function initDemoKeys(): void {
  // Find all elements with data-demo-key attribute
  const keysR = document.querySelectorAll<HTMLElement>('[data-demo-key="r"]');
  const keysS = document.querySelectorAll<HTMLElement>('[data-demo-key="s"]');
  const resetBtn = document.getElementById("video-reset-btn");

  keysR.forEach((key) => {
    key.addEventListener("click", () => toggleDialog());
    key.addEventListener("keydown", preventSpaceActivation);
  });

  keysS.forEach((key) => {
    key.addEventListener("click", () => saveCurrentPosition());
    key.addEventListener("keydown", preventSpaceActivation);
  });

  if (resetBtn) {
    resetBtn.addEventListener("keydown", preventSpaceActivation);
  }
}

// ============================================================================
// Initialization
// ============================================================================

export function initKeyboard(): void {
  document.addEventListener("keydown", handleKeydown);
  initDemoKeys();
}
