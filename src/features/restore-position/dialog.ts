// Restore Position dialog UI

import type { StreamKeysVideoElement } from '@/types';
import { Banner } from '@/ui/banner';
import { Debug, Fullscreen, Video } from '@/core';
import { Styles } from '@/ui/styles/variables';
import { DialogStyles } from './styles';
import { PositionHistory, type PositionHistoryState, type RestorePosition } from './history';

// __DEV__ is defined by vite config based on isWatch
declare const __DEV__: boolean;

// Exported for testing
export const DIALOG_ID = 'streamkeys-restore-dialog';
export const CURRENT_TIME_ID = 'streamkeys-current-time';
export const RELATIVE_TIME_CLASS = 'streamkeys-relative-time';

// Dialog state
let restoreDialog: HTMLDivElement | null = null;
let dialogUpdateInterval: ReturnType<typeof setInterval> | null = null;
// Store container for banner display (needed for Shadow DOM environments like BBC)
let dialogContainer: HTMLElement | null = null;

/**
 * Close the restore dialog
 */
function closeRestoreDialog(): void {
  if (dialogUpdateInterval) {
    clearInterval(dialogUpdateInterval);
    dialogUpdateInterval = null;
  }
  if (restoreDialog) {
    restoreDialog.remove();
    restoreDialog = null;
  }
  dialogContainer = null;
}

/**
 * Check if dialog is currently open
 */
function isDialogOpen(): boolean {
  return restoreDialog !== null;
}

/** Callback type for service-specific seeking */
type SeekToTimeCallback = (time: number, duration: number) => boolean;

/** Callback type for getting dialog container */
type GetDialogContainerCallback = () => HTMLElement | null;

/**
 * Restore video to a specific position.
 * Uses seekToTime callback if provided (for services like Disney+),
 * otherwise falls back to direct video.currentTime assignment.
 */
function restorePosition(
  video: StreamKeysVideoElement | null,
  time: number,
  seekToTime?: SeekToTimeCallback
): void {
  if (!video) return;

  // Use service-specific seeking if provided (e.g., Disney+ timeline click)
  if (seekToTime) {
    const duration = video._streamKeysGetDuration?.() ?? video.duration;
    const success = seekToTime(time, duration);
    if (success) {
      Banner.show(`Restored to ${Video.formatTime(time)}`, dialogContainer);
      return;
    }
    // Fall through to direct seek if callback fails
  }

  // Default: direct video.currentTime assignment
  video.currentTime = time;
  Banner.show(`Restored to ${Video.formatTime(time)}`, dialogContainer);
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
  item.style.cssText = DialogStyles.positionItem;

  item.onmouseenter = () => (item.style.background = Styles.vars.overlay.bgHover);
  item.onmouseleave = () => (item.style.background = Styles.vars.overlay.bgActive);

  // Key hint
  const keyHint = document.createElement('span');
  keyHint.textContent = `${keyNumber}`;
  keyHint.style.cssText = DialogStyles.keyHint;

  // Time label
  const timeLabel = document.createElement('span');
  timeLabel.textContent = pos.label;
  timeLabel.style.cssText = DialogStyles.timeLabel;

  // Relative time
  const relativeTime = document.createElement('span');
  if (!pos.isLoadTime) {
    relativeTime.className = RELATIVE_TIME_CLASS;
    relativeTime.dataset.savedAt = String(pos.relativeText);
  } else {
    relativeTime.textContent = pos.relativeText as string;
  }
  relativeTime.style.cssText = DialogStyles.relativeTime;

  // Progress bar
  const progressBar = document.createElement('div');
  const progressPercent = videoDuration > 0 ? (pos.time / videoDuration) * 100 : 0;
  progressBar.style.cssText = DialogStyles.progressBar;

  const progressFill = document.createElement('div');
  progressFill.style.cssText = DialogStyles.progressFill;
  progressFill.style.width = `${progressPercent}%`;
  progressBar.appendChild(progressFill);

  item.appendChild(keyHint);
  item.appendChild(timeLabel);
  item.appendChild(relativeTime);
  item.appendChild(progressBar);

  item.onclick = (e) => {
    if (__DEV__) Debug.action(`UI: Position ${keyNumber} clicked`, pos.label);
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
function createRestoreDialog(
  historyState: PositionHistoryState,
  getVideoElement: () => StreamKeysVideoElement | null,
  seekToTime?: SeekToTimeCallback,
  getDialogContainer?: GetDialogContainerCallback
): void {
  // Toggle behavior - close if already open
  if (restoreDialog) {
    closeRestoreDialog();
    return;
  }

  // Store container for banner display (needed for Shadow DOM environments like BBC)
  dialogContainer = getDialogContainer?.() ?? null;

  const allPositions = PositionHistory.getPositions(historyState);

  // Show message if no positions available
  if (allPositions.length === 0) {
    Banner.show('No saved positions', dialogContainer);
    return;
  }

  const video = getVideoElement();
  const videoDuration = video?._streamKeysGetDuration?.() ?? 0;

  restoreDialog = document.createElement('div');
  restoreDialog.id = DIALOG_ID;
  restoreDialog.style.cssText = DialogStyles.container;

  // Header
  const header = document.createElement('div');
  header.style.cssText = DialogStyles.header;

  const title = document.createElement('div');
  title.textContent = 'Restore Position';
  title.style.cssText = DialogStyles.title;

  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.style.cssText = DialogStyles.closeButton;
  closeButton.onmouseenter = () => (closeButton.style.color = Styles.vars.text.primary);
  closeButton.onmouseleave = () => (closeButton.style.color = Styles.vars.text.secondary);
  closeButton.onclick = (e) => {
    if (__DEV__) Debug.action('UI: Close button', 'restore dialog');
    e.preventDefault();
    e.stopPropagation();
    closeRestoreDialog();
  };

  header.appendChild(title);
  header.appendChild(closeButton);
  restoreDialog.appendChild(header);

  // Current time display
  const currentTimeContainer = document.createElement('div');
  currentTimeContainer.style.cssText = DialogStyles.currentTimeContainer;

  const currentTimeLabel = document.createElement('span');
  currentTimeLabel.textContent = 'Current time';
  currentTimeLabel.style.cssText = DialogStyles.currentTimeLabel;

  const currentTimeValue = document.createElement('span');
  currentTimeValue.id = CURRENT_TIME_ID;
  currentTimeValue.style.cssText = DialogStyles.currentTimeValue;

  currentTimeContainer.appendChild(currentTimeLabel);
  currentTimeContainer.appendChild(currentTimeValue);
  restoreDialog.appendChild(currentTimeContainer);

  // Position list
  const list = document.createElement('div');
  list.style.cssText = DialogStyles.list;

  const hasLoadTime = allPositions.length > 0 && allPositions[0].isLoadTime;
  const hasHistoryItems = allPositions.some((pos) => !pos.isLoadTime);

  allPositions.forEach((pos, index) => {
    const item = createPositionItem(index, pos, videoDuration, () => {
      restorePosition(video, pos.time, seekToTime);
      closeRestoreDialog();
    });
    list.appendChild(item);

    // Add separator after load time if there are history items
    if (hasLoadTime && hasHistoryItems && index === 0) {
      const separator = document.createElement('div');
      separator.style.cssText = DialogStyles.separator;
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
  hint.style.cssText = DialogStyles.hint;
  restoreDialog.appendChild(hint);

  // Append to custom container if provided (for Shadow DOM environments like BBC),
  // otherwise to fullscreen element if in fullscreen, otherwise to body
  const container = getDialogContainer?.() ?? Fullscreen.getElement() ?? document.body;
  container.appendChild(restoreDialog);

  // Update function for times
  // Note: We search within restoreDialog instead of document because the dialog
  // may be inside a Shadow DOM (e.g., BBC iPlayer), where document queries don't work
  const updateDialogTimes = () => {
    const currentVideo = getVideoElement();
    const currentTimeEl = restoreDialog?.querySelector(`#${CURRENT_TIME_ID}`);
    if (currentTimeEl) {
      const displayTime = currentVideo?._streamKeysGetDisplayTime?.() ?? 0;
      currentTimeEl.textContent = Video.formatTime(displayTime);
    }

    const relativeTimeEls = restoreDialog?.querySelectorAll(`.${RELATIVE_TIME_CLASS}`);
    relativeTimeEls?.forEach((el) => {
      const savedAt = parseInt((el as HTMLElement).dataset.savedAt || '0', 10);
      if (savedAt) {
        el.textContent = Video.formatRelativeTime(savedAt);
      }
    });
  };

  updateDialogTimes();
  dialogUpdateInterval = setInterval(updateDialogTimes, Styles.vars.timing.dialogUpdate);
}

/**
 * Handle keyboard events for the dialog
 */
function handleRestoreDialogKeys(
  e: KeyboardEvent,
  historyState: PositionHistoryState,
  getVideoElement: () => StreamKeysVideoElement | null,
  seekToTime?: SeekToTimeCallback
): boolean {
  if (!restoreDialog) return false;

  // Don't intercept events with modifier keys
  if (e.metaKey || e.ctrlKey) return false;

  // Handle Escape - close dialog
  if (e.code === 'Escape') {
    if (__DEV__) Debug.action('Key: Escape', 'close restore dialog');
    e.preventDefault();
    e.stopPropagation();
    closeRestoreDialog();
    return true;
  }

  // Handle R key - close dialog
  if (e.code === 'KeyR') {
    if (__DEV__) Debug.action('Key: R', 'close restore dialog');
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

    const allPositions = PositionHistory.getPositions(historyState);
    const position = allPositions[keyNum];

    if (position) {
      if (__DEV__) Debug.action(`Key: ${keyNum}`, `restore to ${position.label}`);
      const video = getVideoElement();
      restorePosition(video, position.time, seekToTime);
      closeRestoreDialog();
    }
    return true;
  }

  return false;
}

// Public API
export const RestoreDialog = {
  create: createRestoreDialog,
  close: closeRestoreDialog,
  isOpen: isDialogOpen,
  restore: restorePosition,
  handleKeys: handleRestoreDialogKeys,
};
