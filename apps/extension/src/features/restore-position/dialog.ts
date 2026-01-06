// Restore Position dialog controller - state, events, and logic

import type { StreamKeysVideoElement } from '@/types';
import { Banner } from '@/ui/banner';
import { Debug, Fullscreen, Video } from '@/core';
import { Styles } from '@/ui/styles/variables';
import {
  PositionHistory,
  POSITION_HISTORY_CHANGED_EVENT,
  type PositionHistoryState,
  type RestorePosition,
} from './history';
import {
  createDialogDOM,
  buildPositionList,
  updateHintText,
  DIALOG_ID,
  CURRENT_TIME_ID,
  RELATIVE_TIME_CLASS,
  type DialogElements,
} from './ui/dialog';

// __DEV__ is defined by vite config based on isWatch
declare const __DEV__: boolean;

// Re-export for external use (e.g., tests)
export { DIALOG_ID, CURRENT_TIME_ID, RELATIVE_TIME_CLASS };

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
 * Debug action helper - only logs in dev mode
 */
function debugAction(action: string, detail: string): void {
  if (__DEV__) Debug.action(action, detail);
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

  // Create dialog DOM structure
  const elements: DialogElements = createDialogDOM(closeRestoreDialog, debugAction);
  restoreDialog = elements.container;
  dialogListElement = elements.list;
  dialogHintElement = elements.hint;

  // Handler for position selection (close dialog after selecting)
  const handleSelectPosition = (pos: RestorePosition) => {
    restorePosition(video, pos.time, seekToTime);
    closeRestoreDialog();
  };

  // Build initial position list
  const maxKey = buildPositionList(
    elements.list,
    allPositions,
    videoDuration,
    handleSelectPosition,
    debugAction
  );
  updateHintText(elements.hint, maxKey);

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
        handleSelectPosition,
        debugAction
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
