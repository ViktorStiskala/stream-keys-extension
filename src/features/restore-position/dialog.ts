// Restore Position dialog UI

import type { StreamKeysVideoElement } from '@/types';
import { showBanner } from '@/ui/banner';
import { formatTime, formatRelativeTime } from '@/core/video';
import { cssVars } from '@/ui/styles/variables';
import { dialogStyles } from './styles';
import { type PositionHistoryState, type RestorePosition, getRestorePositions } from './history';

const DIALOG_ID = 'streamkeys-restore-dialog';
const CURRENT_TIME_ID = 'streamkeys-current-time';

// Dialog state
let restoreDialog: HTMLDivElement | null = null;
let dialogUpdateInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Close the restore dialog
 */
export function closeRestoreDialog(): void {
  if (dialogUpdateInterval) {
    clearInterval(dialogUpdateInterval);
    dialogUpdateInterval = null;
  }
  if (restoreDialog) {
    restoreDialog.remove();
    restoreDialog = null;
  }
}

/**
 * Check if dialog is currently open
 */
export function isDialogOpen(): boolean {
  return restoreDialog !== null;
}

/**
 * Restore video to a specific position
 */
export function restorePosition(video: StreamKeysVideoElement | null, time: number): void {
  if (video) {
    video.currentTime = time;
    showBanner(`Restored to ${formatTime(time)}`);
  }
}

/**
 * Create a position item button
 */
function createPositionItem(
  keyNumber: number,
  pos: RestorePosition,
  videoDuration: number,
  onClick: () => void
): HTMLButtonElement {
  const item = document.createElement('button');
  item.style.cssText = dialogStyles.positionItem;

  item.onmouseenter = () => (item.style.background = cssVars.overlay.bgHover);
  item.onmouseleave = () => (item.style.background = cssVars.overlay.bgActive);

  // Key hint
  const keyHint = document.createElement('span');
  keyHint.textContent = `${keyNumber}`;
  keyHint.style.cssText = dialogStyles.keyHint;

  // Time label
  const timeLabel = document.createElement('span');
  timeLabel.textContent = pos.label;
  timeLabel.style.cssText = dialogStyles.timeLabel;

  // Relative time
  const relativeTime = document.createElement('span');
  if (!pos.isLoadTime) {
    relativeTime.className = 'streamkeys-relative-time';
    relativeTime.dataset.savedAt = String(pos.relativeText);
  } else {
    relativeTime.textContent = pos.relativeText as string;
  }
  relativeTime.style.cssText = dialogStyles.relativeTime;

  // Progress bar
  const progressBar = document.createElement('div');
  const progressPercent = videoDuration > 0 ? (pos.time / videoDuration) * 100 : 0;
  progressBar.style.cssText = dialogStyles.progressBar;

  const progressFill = document.createElement('div');
  progressFill.style.cssText = dialogStyles.progressFill;
  progressFill.style.width = `${progressPercent}%`;
  progressBar.appendChild(progressFill);

  item.appendChild(keyHint);
  item.appendChild(timeLabel);
  item.appendChild(relativeTime);
  item.appendChild(progressBar);

  item.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  };

  return item;
}

/**
 * Create the restore dialog.
 * Uses the video's _streamKeysGetPlaybackTime() method for current time display.
 */
export function createRestoreDialog(
  historyState: PositionHistoryState,
  getVideoElement: () => StreamKeysVideoElement | null
): void {
  // Toggle behavior - close if already open
  if (restoreDialog) {
    closeRestoreDialog();
    return;
  }

  const allPositions = getRestorePositions(historyState);

  // Show message if no positions available
  if (allPositions.length === 0) {
    showBanner('No saved positions');
    return;
  }

  const video = getVideoElement();
  const videoDuration = video ? video.duration : 0;

  restoreDialog = document.createElement('div');
  restoreDialog.id = DIALOG_ID;
  restoreDialog.style.cssText = dialogStyles.container;

  // Header
  const header = document.createElement('div');
  header.style.cssText = dialogStyles.header;

  const title = document.createElement('div');
  title.textContent = 'Restore Position';
  title.style.cssText = dialogStyles.title;

  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.style.cssText = dialogStyles.closeButton;
  closeButton.onmouseenter = () => (closeButton.style.color = cssVars.text.primary);
  closeButton.onmouseleave = () => (closeButton.style.color = cssVars.text.secondary);
  closeButton.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeRestoreDialog();
  };

  header.appendChild(title);
  header.appendChild(closeButton);
  restoreDialog.appendChild(header);

  // Current time display
  const currentTimeContainer = document.createElement('div');
  currentTimeContainer.style.cssText = dialogStyles.currentTimeContainer;

  const currentTimeLabel = document.createElement('span');
  currentTimeLabel.textContent = 'Current time';
  currentTimeLabel.style.cssText = dialogStyles.currentTimeLabel;

  const currentTimeValue = document.createElement('span');
  currentTimeValue.id = CURRENT_TIME_ID;
  currentTimeValue.style.cssText = dialogStyles.currentTimeValue;

  currentTimeContainer.appendChild(currentTimeLabel);
  currentTimeContainer.appendChild(currentTimeValue);
  restoreDialog.appendChild(currentTimeContainer);

  // Position list
  const list = document.createElement('div');
  list.style.cssText = dialogStyles.list;

  const hasLoadTime = allPositions.length > 0 && allPositions[0].isLoadTime;
  const hasHistoryItems = allPositions.some((pos) => !pos.isLoadTime);

  allPositions.forEach((pos, index) => {
    const item = createPositionItem(index, pos, videoDuration, () => {
      restorePosition(video, pos.time);
      closeRestoreDialog();
    });
    list.appendChild(item);

    // Add separator after load time if there are history items
    if (hasLoadTime && hasHistoryItems && index === 0) {
      const separator = document.createElement('div');
      separator.style.cssText = dialogStyles.separator;
      list.appendChild(separator);
    }
  });

  restoreDialog.appendChild(list);

  // Hint text
  const maxKey = allPositions.length - 1;
  const hint = document.createElement('div');
  hint.textContent =
    maxKey === 0
      ? 'Press 0 to select, Esc or R to close'
      : `Press 0-${maxKey} to select, Esc or R to close`;
  hint.style.cssText = dialogStyles.hint;
  restoreDialog.appendChild(hint);

  document.body.appendChild(restoreDialog);

  // Update function for times
  const updateDialogTimes = () => {
    const currentVideo = getVideoElement();
    const currentTimeEl = document.getElementById(CURRENT_TIME_ID);
    if (currentTimeEl) {
      const displayTime = currentVideo?._streamKeysGetPlaybackTime?.() ?? 0;
      currentTimeEl.textContent = formatTime(displayTime);
    }

    const relativeTimeEls = document.querySelectorAll('.streamkeys-relative-time');
    relativeTimeEls.forEach((el) => {
      const savedAt = parseInt((el as HTMLElement).dataset.savedAt || '0', 10);
      if (savedAt) {
        el.textContent = formatRelativeTime(savedAt);
      }
    });
  };

  updateDialogTimes();
  dialogUpdateInterval = setInterval(updateDialogTimes, cssVars.timing.dialogUpdate);
}

/**
 * Handle keyboard events for the dialog
 */
export function handleRestoreDialogKeys(
  e: KeyboardEvent,
  historyState: PositionHistoryState,
  getVideoElement: () => StreamKeysVideoElement | null
): boolean {
  if (!restoreDialog) return false;

  // Don't intercept events with modifier keys
  if (e.metaKey || e.ctrlKey) return false;

  // Handle Escape - close dialog
  if (e.code === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    closeRestoreDialog();
    return true;
  }

  // Handle R key - close dialog
  if (e.code === 'KeyR') {
    e.preventDefault();
    e.stopPropagation();
    closeRestoreDialog();
    return true;
  }

  // Handle number keys 0-3
  const keyNum = parseInt(e.key, 10);
  if (keyNum >= 0 && keyNum <= 3) {
    e.preventDefault();
    e.stopPropagation();

    const allPositions = getRestorePositions(historyState);
    const position = allPositions[keyNum];

    if (position) {
      const video = getVideoElement();
      restorePosition(video, position.time);
      closeRestoreDialog();
    }
    return true;
  }

  return false;
}
