// Position Rendering and Management

import type { Position } from "./types";
import { DURATION_SECONDS } from "./config";
import { formatTime, formatRelativeTime, getProgressPercent } from "./time";
import {
  dispatchTimeUpdate,
  dispatchHistoryChange,
  dispatchCloseDialog,
} from "./events";
import {
  getPositions,
  getUserSavedPosition,
  setUserSavedPosition,
  getCurrentVideoSeconds,
  setCurrentVideoSeconds,
  getIsDialogOpen,
  addPosition,
  removePosition,
  getHistoryPositionCount,
  getOldestHistoryPositionIndex,
  findSimilarPositionIndex,
} from "./state";
import { showBanner } from "./banner";

// ============================================================================
// DOM Rendering
// ============================================================================

function createPositionElement(
  pos: Position,
  keyNumber: number,
): HTMLButtonElement {
  const button = document.createElement("button");

  // Base classes for all position items
  const baseClasses = [
    "position-item",
    "relative",
    "flex",
    "items-center",
    "gap-3",
    "px-4",
    "py-3",
    "pb-5",
    "rounded-lg",
    "text-left",
    "transition-colors",
    "cursor-pointer",
    "w-full",
  ];

  // Apply different styles for user saved position
  if (pos.isUserSaved) {
    button.className = [
      ...baseClasses,
      "bg-green-500/15",
      "border",
      "border-green-500/40",
      "hover:bg-green-500/25",
    ].join(" ");
  } else {
    button.className = [
      ...baseClasses,
      "bg-surface",
      "border",
      "border-border",
      "hover:bg-bg-elevated",
    ].join(" ");
  }

  // Calculate display label
  // For user saved position, always show "saved position"
  // For others with savedAt timestamp, calculate relative time
  let displayLabel = pos.label;
  if (pos.isUserSaved) {
    displayLabel = "saved position";
  } else if (pos.savedAt !== undefined) {
    const secondsAgo = Math.floor((Date.now() - pos.savedAt) / 1000);
    displayLabel = formatRelativeTime(secondsAgo);
  }

  // Store time for click handler
  button.dataset.timeSeconds = String(pos.timeSeconds);
  button.dataset.keyNumber = String(keyNumber);

  // Create inner HTML
  button.innerHTML = `
    <span class="inline-flex items-center justify-center w-6 h-6 bg-border rounded text-sm font-semibold shrink-0">${keyNumber}</span>
    <span class="flex-1 font-mono tabular-nums text-text">${pos.time}</span>
    <span class="text-xs text-text-muted shrink-0 relative-time" data-saved-at="${pos.savedAt ?? ""}" data-is-user-saved="${pos.isUserSaved ?? false}">${displayLabel}</span>
    <div class="absolute bottom-2 left-4 right-4 h-[3px] bg-border rounded-full overflow-hidden">
      <div class="h-full bg-gold rounded-full" style="width: ${getProgressPercent(pos.timeSeconds)}%"></div>
    </div>
  `;

  // Add click handler
  button.addEventListener("click", () => {
    restoreToPosition(pos.timeSeconds, pos.time);
  });

  return button;
}

function createSeparator(): HTMLDivElement {
  const separator = document.createElement("div");
  separator.className =
    "h-px bg-linear-to-r from-transparent via-white/15 to-transparent -mx-2";
  return separator;
}

export function renderPositions(): void {
  const container = document.getElementById("position-list");
  if (!container) return;

  const positions = getPositions();
  const userSavedPosition = getUserSavedPosition();

  // Clear container
  container.innerHTML = "";

  // Get load time position (always first, key 0)
  const loadTimePos = positions.find((p) => p.isLoadTime);
  const historyPositions = positions.filter(
    (p) => !p.isLoadTime && !p.isUserSaved,
  );

  // Render load time (key 0)
  if (loadTimePos) {
    container.appendChild(createPositionElement(loadTimePos, 0));
    container.appendChild(createSeparator());
  }

  // Determine key numbering:
  // - If user saved position exists: saved=1, history starts at 2
  // - If no user saved position: history starts at 1
  let currentKey = 1;

  // Render user saved position (key 1 if exists)
  if (userSavedPosition) {
    container.appendChild(createPositionElement(userSavedPosition, currentKey));
    currentKey++;
  }

  // Render history positions
  for (const pos of historyPositions) {
    container.appendChild(createPositionElement(pos, currentKey));
    currentKey++;
  }

  // Update hint text with correct key range
  updateDialogHintText(currentKey - 1);
}

function updateDialogHintText(maxKey: number): void {
  const hintEl = document.getElementById("hint-text");
  if (hintEl) {
    if (maxKey === 0) {
      hintEl.textContent = `Press 0 to select, Esc or R to close`;
    } else {
      hintEl.textContent = `Press 0-${maxKey} to select, Esc or R to close`;
    }
  }
}

// ============================================================================
// Position Restoration
// ============================================================================

export function restoreToPosition(
  timeSeconds: number,
  formattedTime: string,
): void {
  // Update current video time
  setCurrentVideoSeconds(timeSeconds);

  // Show banner
  showBanner(`Restored to ${formattedTime}`);

  // Request dialog close (handled by index.ts listener to avoid circular dependency)
  dispatchCloseDialog();

  // Dispatch time update event
  dispatchTimeUpdate(getCurrentVideoSeconds(), DURATION_SECONDS);
}

export function selectPositionByKey(keyNumber: number): void {
  const positions = getPositions();
  const userSavedPosition = getUserSavedPosition();

  // Find the position with this key
  const loadTimePos = positions.find((p) => p.isLoadTime);
  const historyPositions = positions.filter(
    (p) => !p.isLoadTime && !p.isUserSaved,
  );

  if (keyNumber === 0 && loadTimePos) {
    restoreToPosition(loadTimePos.timeSeconds, loadTimePos.time);
    return;
  }

  let currentKey = 1;

  if (userSavedPosition) {
    if (keyNumber === currentKey) {
      restoreToPosition(userSavedPosition.timeSeconds, userSavedPosition.time);
      return;
    }
    currentKey++;
  }

  for (const pos of historyPositions) {
    if (keyNumber === currentKey) {
      restoreToPosition(pos.timeSeconds, pos.time);
      return;
    }
    currentKey++;
  }
}

// ============================================================================
// Save Position
// ============================================================================

export function saveCurrentPosition(): void {
  const currentSeconds = getCurrentVideoSeconds();
  const formattedTime = formatTime(currentSeconds);

  // Create new user saved position
  const newPosition: Position = {
    time: formattedTime,
    timeSeconds: currentSeconds,
    label: "saved position",
    isUserSaved: true,
  };

  setUserSavedPosition(newPosition);

  // Show banner
  showBanner(`Position saved: ${formattedTime}`);

  // Re-render the positions
  renderPositions();

  // Dispatch history change event
  dispatchHistoryChange();

  // Flash effect on the saved position
  setTimeout(() => {
    const savedEl = document.querySelector(".position-item.bg-green-500\\/15");
    if (savedEl) {
      savedEl.classList.add("ring-2", "ring-green-500/50");
      setTimeout(() => {
        savedEl.classList.remove("ring-2", "ring-green-500/50");
      }, 300);
    }
  }, 50);
}

export function savePositionFromProgressBar(
  preSeekTime: number,
  saveToHistory = true,
): void {
  if (!saveToHistory) {
    return;
  }

  // Add to history positions (not user saved)
  // Find if there's a similar position already
  const existingIndex = findSimilarPositionIndex(preSeekTime);

  if (existingIndex === -1) {
    // Add new position at the beginning of history (after load time)
    const newPos: Position = {
      time: formatTime(preSeekTime),
      timeSeconds: preSeekTime,
      label: "just now",
      savedAt: Date.now(),
    };

    addPosition(newPos, true);

    // Keep only 3 history positions (excluding load time and user saved)
    if (getHistoryPositionCount() > 3) {
      // Remove the oldest (last) history position
      const oldestIndex = getOldestHistoryPositionIndex();
      if (oldestIndex >= 0) {
        removePosition(oldestIndex);
      }
    }
  }

  // Dispatch history change event
  dispatchHistoryChange();

  // Re-render if dialog is open
  if (getIsDialogOpen()) {
    renderPositions();
  }
}

// ============================================================================
// Time Updates
// ============================================================================

export function updateCurrentTimeDisplay(): void {
  const currentTimeEl = document.getElementById("dialog-current-time");
  if (currentTimeEl) {
    currentTimeEl.textContent = formatTime(getCurrentVideoSeconds());
  }
}

export function updateRelativeTimes(): void {
  document.querySelectorAll(".relative-time").forEach((el) => {
    const isUserSaved = el.getAttribute("data-is-user-saved") === "true";
    if (isUserSaved) {
      // User saved position always shows "saved position"
      el.textContent = "saved position";
      return;
    }

    const savedAtStr = el.getAttribute("data-saved-at");
    if (savedAtStr) {
      const savedAt = parseInt(savedAtStr, 10);
      const secondsAgo = Math.floor((Date.now() - savedAt) / 1000);
      el.textContent = formatRelativeTime(secondsAgo);
    }
  });
}

export function updateTimes(): void {
  updateCurrentTimeDisplay();
  updateRelativeTimes();
}
