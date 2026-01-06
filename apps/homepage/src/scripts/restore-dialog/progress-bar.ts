// Progress Bar with Drag Support, Hover Tooltip, and Reset

import { DURATION_SECONDS, VIDEOS } from "./config";
import { formatTime, getProgressPercent } from "./time";
import { EVENTS, dispatchTimeUpdate } from "./events";
import {
  getCurrentVideoSeconds,
  setCurrentVideoSeconds,
  resetState,
  getIsDialogOpen,
} from "./state";
import { savePositionFromProgressBar, renderPositions } from "./positions";

// ============================================================================
// Random Video Selection
// ============================================================================

function setRandomVideo(): void {
  const titleEl = document.getElementById("video-title");
  const subtitleEl = document.getElementById("video-subtitle");
  if (!titleEl || !subtitleEl) return;

  const randomIndex = Math.floor(Math.random() * VIDEOS.length);
  const video = VIDEOS[randomIndex];

  titleEl.textContent = video.title;
  subtitleEl.textContent = video.subtitle;
}

// ============================================================================
// State
// ============================================================================

let isDragging = false;

// ============================================================================
// DOM Helpers
// ============================================================================

interface ProgressBarElements {
  container: HTMLElement;
  fill: HTMLElement | null;
  scrubber: HTMLElement | null;
  tooltip: HTMLElement | null;
  timeRemaining: HTMLElement | null;
}

function getProgressBarElements(): ProgressBarElements | null {
  const container = document.getElementById("video-progress-container");
  if (!container) return null;

  return {
    container,
    fill: document.getElementById("video-progress-fill"),
    scrubber: document.getElementById("video-progress-scrubber"),
    tooltip: document.getElementById("video-progress-tooltip"),
    timeRemaining: document.getElementById("video-time-remaining"),
  };
}

// ============================================================================
// Progress Bar Updates
// ============================================================================

function updateProgressBarUI(
  elements: ProgressBarElements,
  animate = true,
): void {
  const currentTime = getCurrentVideoSeconds();
  const percent = getProgressPercent(currentTime);

  if (elements.fill) {
    // Disable transition when dragging for instant response
    elements.fill.style.transition = animate ? "" : "none";
    elements.fill.style.width = `${percent}%`;
  }
  if (elements.scrubber) {
    elements.scrubber.style.left = `${percent}%`;
  }
  if (elements.timeRemaining) {
    const remaining = DURATION_SECONDS - currentTime;
    elements.timeRemaining.textContent = `-${formatTime(remaining)}`;
  }
}

function calculateTimeFromPosition(
  clientX: number,
  container: HTMLElement,
): number {
  const rect = container.getBoundingClientRect();
  const percent = Math.max(
    0,
    Math.min(100, ((clientX - rect.left) / rect.width) * 100),
  );
  return Math.floor((percent / 100) * DURATION_SECONDS);
}

// ============================================================================
// Event Handlers
// ============================================================================

function handleMouseMove(e: MouseEvent, elements: ProgressBarElements): void {
  const timeAtPosition = calculateTimeFromPosition(
    e.clientX,
    elements.container,
  );
  const percent = getProgressPercent(timeAtPosition);

  if (elements.tooltip) {
    elements.tooltip.textContent = formatTime(timeAtPosition);
    elements.tooltip.style.left = `${percent}%`;
    elements.tooltip.style.opacity = "1";
  }
}

function handleMouseLeave(elements: ProgressBarElements): void {
  if (elements.tooltip) {
    elements.tooltip.style.opacity = "0";
  }
}

function handleClick(e: MouseEvent, elements: ProgressBarElements): void {
  // Don't process click if we just finished dragging
  if (isDragging) return;

  const timeAtPosition = calculateTimeFromPosition(
    e.clientX,
    elements.container,
  );

  // Save pre-seek position to history
  const preSeekTime = getCurrentVideoSeconds();
  savePositionFromProgressBar(preSeekTime);

  // Update current time
  setCurrentVideoSeconds(timeAtPosition);

  // Dispatch time update
  dispatchTimeUpdate(getCurrentVideoSeconds(), DURATION_SECONDS);

  // Update progress bar immediately
  updateProgressBarUI(elements);
}

function handleDragStart(
  e: MouseEvent | TouchEvent,
  elements: ProgressBarElements,
): void {
  isDragging = true;

  const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
  const timeAtPosition = calculateTimeFromPosition(clientX, elements.container);

  // Update visual position immediately during drag
  const percent = getProgressPercent(timeAtPosition);
  if (elements.fill) {
    elements.fill.style.width = `${percent}%`;
  }
  if (elements.scrubber) {
    elements.scrubber.style.left = `${percent}%`;
    elements.scrubber.style.opacity = "1";
  }
}

function handleDragMove(
  e: MouseEvent | TouchEvent,
  elements: ProgressBarElements,
  preSeekTime: number,
): void {
  if (!isDragging) return;

  const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
  const timeAtPosition = calculateTimeFromPosition(clientX, elements.container);
  const percent = getProgressPercent(timeAtPosition);

  // Update visual position - disable transition for instant response
  if (elements.fill) {
    elements.fill.style.transition = "none";
    elements.fill.style.width = `${percent}%`;
  }
  if (elements.scrubber) {
    elements.scrubber.style.left = `${percent}%`;
  }
  if (elements.tooltip) {
    elements.tooltip.textContent = formatTime(timeAtPosition);
    elements.tooltip.style.left = `${percent}%`;
    elements.tooltip.style.opacity = "1";
  }
  if (elements.timeRemaining) {
    const remaining = DURATION_SECONDS - timeAtPosition;
    elements.timeRemaining.textContent = `-${formatTime(remaining)}`;
  }

  // Store the current drag position temporarily (will be committed on drag end)
  elements.container.dataset.dragTime = String(timeAtPosition);
  elements.container.dataset.preSeekTime = String(preSeekTime);
}

function handleDragEnd(elements: ProgressBarElements): void {
  if (!isDragging) return;

  isDragging = false;

  const dragTime = elements.container.dataset.dragTime;
  const preSeekTime = elements.container.dataset.preSeekTime;

  if (dragTime !== undefined) {
    const timeAtPosition = parseInt(dragTime, 10);
    const preSeek = preSeekTime
      ? parseInt(preSeekTime, 10)
      : getCurrentVideoSeconds();

    // Save pre-drag position to history
    savePositionFromProgressBar(preSeek);

    // Update current time
    setCurrentVideoSeconds(timeAtPosition);

    // Dispatch time update
    dispatchTimeUpdate(getCurrentVideoSeconds(), DURATION_SECONDS);

    // Update progress bar (re-enable animation)
    if (elements.fill) {
      elements.fill.style.transition = "";
    }
    updateProgressBarUI(elements);

    // Clean up
    delete elements.container.dataset.dragTime;
    delete elements.container.dataset.preSeekTime;
  }

  // Hide scrubber unless hovering
  if (elements.scrubber) {
    elements.scrubber.style.opacity = "";
  }
}

// ============================================================================
// Reset Handler
// ============================================================================

function handleReset(elements: ProgressBarElements): void {
  // Reset state (clears all positions except load time)
  resetState();

  // Pick a new random video
  setRandomVideo();

  // Update progress bar UI directly (without dispatching events that save to history)
  updateProgressBarUI(elements);

  // Re-render positions if dialog is open
  if (getIsDialogOpen()) {
    renderPositions();
  }
}

// ============================================================================
// Initialization
// ============================================================================

export function initProgressBar(): void {
  const elements = getProgressBarElements();
  if (!elements) return;

  // Store pre-seek time for drag operations
  let preSeekTimeForDrag = getCurrentVideoSeconds();

  // Pick a random video on load
  setRandomVideo();

  // Initial update
  updateProgressBarUI(elements);

  // Listen for time updates
  window.addEventListener(EVENTS.TIME_UPDATE, () => {
    if (!isDragging) {
      updateProgressBarUI(elements);
    }
  });

  // Hover tooltip
  elements.container.addEventListener("mousemove", (e) => {
    handleMouseMove(e, elements);
  });

  elements.container.addEventListener("mouseleave", () => {
    handleMouseLeave(elements);
  });

  // Click to seek
  elements.container.addEventListener("click", (e) => {
    handleClick(e, elements);
  });

  // Drag support - Mouse
  elements.container.addEventListener("mousedown", (e) => {
    preSeekTimeForDrag = getCurrentVideoSeconds();
    handleDragStart(e, elements);
    e.preventDefault(); // Prevent text selection
  });

  document.addEventListener("mousemove", (e) => {
    handleDragMove(e, elements, preSeekTimeForDrag);
  });

  document.addEventListener("mouseup", () => {
    handleDragEnd(elements);
  });

  // Drag support - Touch
  elements.container.addEventListener("touchstart", (e) => {
    preSeekTimeForDrag = getCurrentVideoSeconds();
    handleDragStart(e, elements);
  });

  document.addEventListener("touchmove", (e) => {
    handleDragMove(e, elements, preSeekTimeForDrag);
  });

  document.addEventListener("touchend", () => {
    handleDragEnd(elements);
  });

  // Reset button
  const resetBtn = document.getElementById("video-reset-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleReset(elements);
    });
  }

  // Playback simulation - advance 1 second every second
  setInterval(() => {
    if (!isDragging) {
      let currentSeconds = getCurrentVideoSeconds();
      currentSeconds += 1;
      if (currentSeconds >= DURATION_SECONDS) {
        currentSeconds = 0; // Loop
      }
      setCurrentVideoSeconds(currentSeconds);
      dispatchTimeUpdate(getCurrentVideoSeconds(), DURATION_SECONDS);
    }
  }, 1000);
}
