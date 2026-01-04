// Restore Position dialog UI

import type { StreamKeysVideoElement } from '@/types';
import { Banner } from '@/ui/banner';
import { Debug, Fullscreen, Video } from '@/core';
import { Styles } from '@/ui/styles/variables';
import { DialogStyles } from './styles';
import {
  PositionHistory,
  POSITION_HISTORY_CHANGED_EVENT,
  type PositionHistoryState,
  type RestorePosition,
} from './history';

// __DEV__ is defined by vite config based on isWatch
declare const __DEV__: boolean;

// Exported for testing
export const DIALOG_ID = 'streamkeys-restore-dialog';
export const CURRENT_TIME_ID = 'streamkeys-current-time';
export const RELATIVE_TIME_CLASS = 'streamkeys-relative-time';

// Dialog state
let restoreDialog: HTMLDivElement | null = null;
let dialogUpdateInterval: ReturnType<typeof setInterval> | null = null;
let positionChangeHandler: (() => void) | null = null;

// Dialog element references for reactive updates
let dialogListElement: HTMLDivElement | null = null;
let dialogHintElement: HTMLDivElement | null = null;

/**
 * Close the restore dialog
 */
function closeRestoreDialog(): void {
  if (positionChangeHandler) {
    window.removeEventListener(POSITION_HISTORY_CHANGED_EVENT, positionChangeHandler);
    positionChangeHandler = null;
  }
  if (dialogUpdateInterval) {
    clearInterval(dialogUpdateInterval);
    dialogUpdateInterval = null;
  }
  if (restoreDialog) {
    restoreDialog.remove();
    restoreDialog = null;
  }
  dialogListElement = null;
  dialogHintElement = null;
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
      Banner.show(`Restored to ${Video.formatTime(time)}`);
      return;
    }
    // Fall through to direct seek if callback fails
  }

  // Default: direct video.currentTime assignment
  video.currentTime = time;
  Banner.show(`Restored to ${Video.formatTime(time)}`);
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

  // Use green styling for user saved position
  if (pos.isUserSaved) {
    item.style.cssText = DialogStyles.positionItemUserSaved;
    item.onmouseenter = () => (item.style.background = Styles.vars.accent.greenHover);
    item.onmouseleave = () => (item.style.background = Styles.vars.accent.green);
  } else {
    item.style.cssText = DialogStyles.positionItem;
    item.onmouseenter = () => (item.style.background = Styles.vars.overlay.bgHover);
    item.onmouseleave = () => (item.style.background = Styles.vars.overlay.bgActive);
  }

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
  if (pos.isLoadTime || pos.isUserSaved) {
    // Static text for load time and user saved positions
    relativeTime.textContent = pos.relativeText as string;
  } else {
    // Dynamic relative time for history positions
    relativeTime.className = RELATIVE_TIME_CLASS;
    relativeTime.dataset.savedAt = String(pos.relativeText);
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
 * Build the position list inside the dialog.
 * Can be called for initial render or to rebuild on position changes.
 * @returns maxKey for updating hint text
 */
function buildPositionList(
  listElement: HTMLDivElement,
  positions: RestorePosition[],
  videoDuration: number,
  onSelectPosition: (pos: RestorePosition) => void
): number {
  // Clear existing items
  listElement.innerHTML = '';

  const hasUserSaved = positions.some((pos) => pos.isUserSaved);
  const hasHistoryItems = positions.some((pos) => !pos.isLoadTime && !pos.isUserSaved);

  // Key numbering: load time = 0 (reserved), user saved = 1 (reserved), history continues from there
  const historyStartKey = hasUserSaved ? 2 : 1;
  let historyKeyNumber = historyStartKey;

  positions.forEach((pos) => {
    // Determine key number based on position type
    let keyNumber: number;
    if (pos.isLoadTime) {
      keyNumber = 0;
    } else if (pos.isUserSaved) {
      keyNumber = 1;
    } else {
      keyNumber = historyKeyNumber++;
    }

    const item = createPositionItem(keyNumber, pos, videoDuration, () => {
      onSelectPosition(pos);
    });
    listElement.appendChild(item);

    // Add separator after load time if there are other items (user saved or history)
    if (pos.isLoadTime && (hasUserSaved || hasHistoryItems)) {
      const separator = document.createElement('div');
      separator.style.cssText = DialogStyles.separator;
      listElement.appendChild(separator);
    }
  });

  // Calculate max key
  const historyCount = positions.filter((pos) => !pos.isLoadTime && !pos.isUserSaved).length;
  const maxKey = historyCount > 0 ? historyStartKey + historyCount - 1 : hasUserSaved ? 1 : 0;

  return maxKey;
}

/**
 * Update the hint text based on max key
 */
function updateHintText(hintElement: HTMLDivElement, maxKey: number): void {
  hintElement.textContent =
    maxKey === 0
      ? 'Press 0 to select, Esc or R to close'
      : `Press 0-${maxKey} to select, Esc or R to close`;
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

  const allPositions = PositionHistory.getPositions(historyState);

  // Show message if no positions available
  if (allPositions.length === 0) {
    Banner.show('No saved positions');
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
  dialogListElement = list;

  // Handler for position selection (close dialog after selecting)
  const handleSelectPosition = (pos: RestorePosition) => {
    restorePosition(video, pos.time, seekToTime);
    closeRestoreDialog();
  };

  // Build initial position list
  const maxKey = buildPositionList(list, allPositions, videoDuration, handleSelectPosition);
  restoreDialog.appendChild(list);

  // Hint text
  const hint = document.createElement('div');
  hint.style.cssText = DialogStyles.hint;
  dialogHintElement = hint;
  updateHintText(hint, maxKey);
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

  // Listen for position history changes to update the dialog reactively
  positionChangeHandler = () => {
    const newPositions = PositionHistory.getPositions(historyState);

    // Close dialog if no positions left (e.g., video changed with no history)
    if (newPositions.length === 0) {
      closeRestoreDialog();
      return;
    }

    // Rebuild position list with new data
    if (dialogListElement && dialogHintElement) {
      const currentVideo = getVideoElement();
      const currentDuration = currentVideo?._streamKeysGetDuration?.() ?? 0;
      const newMaxKey = buildPositionList(
        dialogListElement,
        newPositions,
        currentDuration,
        handleSelectPosition
      );
      updateHintText(dialogHintElement, newMaxKey);
    }
  };
  window.addEventListener(POSITION_HISTORY_CHANGED_EVENT, positionChangeHandler);
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

  // Handle number keys 0-4 (load time = 0, user saved = 1, history = 1 or 2+)
  const keyNum = parseInt(e.key, 10);
  if (keyNum >= 0 && keyNum <= 4) {
    e.preventDefault();
    e.stopPropagation();

    const allPositions = PositionHistory.getPositions(historyState);

    // Build key-to-position map (keys are assigned by type, not array index)
    const hasUserSaved = allPositions.some((pos) => pos.isUserSaved);
    const historyStartKey = hasUserSaved ? 2 : 1;
    let historyKeyNumber = historyStartKey;

    let position: RestorePosition | undefined;
    for (const pos of allPositions) {
      const posKey = pos.isLoadTime ? 0 : pos.isUserSaved ? 1 : historyKeyNumber++;
      if (posKey === keyNum) {
        position = pos;
        break;
      }
    }

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
