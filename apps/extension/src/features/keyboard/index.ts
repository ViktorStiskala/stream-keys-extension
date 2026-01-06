// Keyboard feature - global key event handling

import type { CleanupFn, StreamKeysVideoElement } from '@/types';
import { Debug, Settings, Video } from '@/core';
import type { RestorePositionAPI } from '@/features/restore-position';
import type { SubtitlesAPI } from '@/features/subtitles';

// __DEV__ is defined by vite config based on isWatch
declare const __DEV__: boolean;

/**
 * Fallback timeout for resetting keyboard seek flag if 'seeked' event never fires (ms).
 * Used when video element exists but seek doesn't complete normally.
 */
const KEYBOARD_SEEK_FLAG_TIMEOUT_MS = 2000;

/**
 * Check if a key event should be ignored (modifier keys or user typing in input)
 */
function shouldIgnoreKeyEvent(e: KeyboardEvent): boolean {
  // Don't intercept events with modifier keys
  if (e.metaKey || e.ctrlKey || e.altKey) {
    return true;
  }

  // Skip if user is typing in an input/textarea
  const activeEl = document.activeElement;
  if (
    activeEl &&
    (activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      (activeEl as HTMLElement).isContentEditable)
  ) {
    return true;
  }

  return false;
}

/**
 * Timeout for resetting keyboard seek flag when no video element is available (ms).
 */
const KEYBOARD_SEEK_FLAG_NO_VIDEO_TIMEOUT_MS = 500;

export interface DialogOnlyConfig {
  /** RestorePosition API for dialog key handling */
  restorePosition: RestorePositionAPI;
  /** Get the video element for S key position saving */
  getVideoElement: () => StreamKeysVideoElement | null;
}

export interface DialogOnlyAPI {
  /** Handle a key event */
  handleKey: (e: KeyboardEvent) => void;
  /** Cleanup resources */
  cleanup: CleanupFn;
}

/**
 * Initialize lightweight keyboard handler for restore dialog only (R key + S key + dialog keys)
 * Used when keyboard feature is disabled but restorePosition is enabled
 */
function initDialogOnly(config: DialogOnlyConfig): DialogOnlyAPI {
  const { restorePosition, getVideoElement } = config;

  const handleDialogKeys = (e: KeyboardEvent) => {
    // Handle dialog keys first (ESC, number keys when dialog is open)
    if (restorePosition.handleDialogKeys(e)) {
      return;
    }

    // Check for modifier keys or user typing in input
    if (shouldIgnoreKeyEvent(e)) {
      return;
    }

    // Handle R key to open restore dialog
    if (e.code === 'KeyR' && Settings.isPositionHistoryEnabled()) {
      if (__DEV__) Debug.action('Key: R', 'open restore dialog');
      e.preventDefault();
      e.stopPropagation();
      restorePosition.openDialog();
      return;
    }

    // Handle S key to save user position
    if (e.code === 'KeyS' && Settings.isPositionHistoryEnabled()) {
      const video = getVideoElement();
      const currentTime = video?._streamKeysGetPlaybackTime?.() ?? video?.currentTime;
      if (currentTime !== undefined && currentTime !== null) {
        if (__DEV__) Debug.action('Key: S', `save position ${Video.formatTime(currentTime)}`);
        e.preventDefault();
        e.stopPropagation();
        restorePosition.saveUserPosition(currentTime);
      }
    }
  };

  // Use capture phase to intercept before any other handlers
  window.addEventListener('keydown', handleDialogKeys, true);

  return {
    handleKey: handleDialogKeys,
    cleanup: () => {
      window.removeEventListener('keydown', handleDialogKeys, true);
    },
  };
}

export interface KeyboardConfig {
  /** Get the augmented video element (with _streamKeysGetPlaybackTime method) */
  getVideoElement: () => StreamKeysVideoElement | null;
  getButton?: (keyCode: string) => HTMLElement | null;
  restorePosition?: RestorePositionAPI;
  subtitles?: SubtitlesAPI;
  /** Seek forward/backward by delta seconds */
  seekByDelta: (video: HTMLVideoElement, delta: number) => void;
}

export interface KeyboardAPI {
  /** Handle a key event */
  handleKey: (e: KeyboardEvent) => void;
  /** Cleanup resources */
  cleanup: CleanupFn;
}

/**
 * Initialize the Keyboard feature
 */
function initKeyboard(config: KeyboardConfig): KeyboardAPI {
  const { getVideoElement, getButton, restorePosition, subtitles, seekByDelta } = config;

  /**
   * Track position before seeking for position history.
   * Uses 'seeked' event to reset flag accurately when seek completes,
   * with a timeout fallback for edge cases where 'seeked' never fires.
   *
   * IMPORTANT: We track and remove previous listeners/timeouts to handle rapid key presses.
   * Without this, each key press adds a new listener, and the first 'seeked' event
   * would reset the flag while the user is still pressing keys, causing handleSeeking
   * to log "UI: Timeline click" and save positions that should be debounced.
   */
  let activeResetListener: (() => void) | null = null;
  let activeResetTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastTrackedVideo: StreamKeysVideoElement | null = null;

  const trackPositionBeforeSeek = (video: StreamKeysVideoElement | null) => {
    if (!restorePosition) return;

    // Remove previous listener and timeout
    if (activeResetListener && lastTrackedVideo) {
      lastTrackedVideo.removeEventListener('seeked', activeResetListener);
    }
    if (activeResetTimeout !== null) {
      clearTimeout(activeResetTimeout);
    }

    restorePosition.setKeyboardSeek(true);
    const currentTime = video?._streamKeysGetStableTime?.();
    if (currentTime !== undefined) {
      restorePosition.recordBeforeSeek(currentTime);
    }

    // Reset flag when seek completes (seeked event) or after timeout as fallback
    if (video) {
      lastTrackedVideo = video;

      const resetFlag = () => {
        restorePosition.setKeyboardSeek(false);
        if (lastTrackedVideo) {
          lastTrackedVideo.removeEventListener('seeked', resetFlag);
        }
        activeResetListener = null;
      };

      activeResetListener = resetFlag;
      video.addEventListener('seeked', resetFlag, { once: true });

      // Fallback timeout in case seeked never fires (e.g., service doesn't emit it)
      // Only extend timeout if this was a debounced save (rapid key presses)
      activeResetTimeout = setTimeout(() => {
        if (lastTrackedVideo && activeResetListener) {
          lastTrackedVideo.removeEventListener('seeked', activeResetListener);
        }
        restorePosition.setKeyboardSeek(false);
        activeResetListener = null;
        activeResetTimeout = null;
      }, KEYBOARD_SEEK_FLAG_TIMEOUT_MS);
    } else {
      lastTrackedVideo = null;
      activeResetListener = null;
      activeResetTimeout = setTimeout(() => {
        restorePosition.setKeyboardSeek(false);
        activeResetTimeout = null;
      }, KEYBOARD_SEEK_FLAG_NO_VIDEO_TIMEOUT_MS);
    }
  };

  // Helper to perform seek action
  const performSeek = (
    video: StreamKeysVideoElement | null,
    direction: 'backward' | 'forward'
  ): boolean => {
    if (!video) return false;

    const delta =
      direction === 'backward'
        ? -(Settings.isCustomSeekEnabled() ? Settings.getSeekTime() : 10)
        : Settings.isCustomSeekEnabled()
          ? Settings.getSeekTime()
          : 10;

    seekByDelta(video, delta);
    return true;
  };

  const handleGlobalKeys = (e: KeyboardEvent) => {
    // Handle restore dialog keys first - must capture ESC before it exits fullscreen
    if (restorePosition?.handleDialogKeys(e)) {
      return;
    }

    // Check for modifier keys or user typing in input
    if (shouldIgnoreKeyEvent(e)) {
      return;
    }

    // Handle subtitle toggle
    if (e.code === 'KeyC' && subtitles) {
      if (__DEV__) Debug.action('Key: C', 'toggle subtitles');
      e.preventDefault();
      e.stopPropagation();
      subtitles.toggle();
      return;
    }

    // Handle position restore dialog
    if (e.code === 'KeyR' && restorePosition && Settings.isPositionHistoryEnabled()) {
      if (__DEV__) Debug.action('Key: R', 'open restore dialog');
      e.preventDefault();
      e.stopPropagation();
      restorePosition.openDialog();
      return;
    }

    // Handle save user position
    if (e.code === 'KeyS' && restorePosition && Settings.isPositionHistoryEnabled()) {
      const video = getVideoElement();
      const currentTime = video?._streamKeysGetPlaybackTime?.() ?? video?.currentTime;
      if (currentTime !== undefined && currentTime !== null) {
        if (__DEV__) Debug.action('Key: S', `save position ${Video.formatTime(currentTime)}`);
        e.preventDefault();
        e.stopPropagation();
        restorePosition.saveUserPosition(currentTime);
      }
      return;
    }

    // Handle arrow keys for seeking
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      const video = getVideoElement();
      const direction = e.code === 'ArrowLeft' ? 'backward' : 'forward';

      if (__DEV__) {
        const seekTime = Settings.isCustomSeekEnabled() ? Settings.getSeekTime() : 10;
        Debug.action(`Key: ${e.code}`, `seek ${direction} ${seekTime}s`);
      }

      trackPositionBeforeSeek(video);

      if (performSeek(video, direction)) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    // Handle other keys via config (Space, F, etc.)
    if (!getButton) return;

    const button = getButton(e.code);
    if (!button) return;

    if (__DEV__) {
      const keyAction =
        e.code === 'Space' ? 'play/pause' : e.code === 'KeyF' ? 'fullscreen' : e.code;
      Debug.action(`Key: ${e.code}`, keyAction);
    }

    e.preventDefault();
    e.stopPropagation();
    button.click();
  };

  // Use capture phase to intercept before any other handlers
  window.addEventListener('keydown', handleGlobalKeys, true);

  return {
    handleKey: handleGlobalKeys,
    cleanup: () => {
      window.removeEventListener('keydown', handleGlobalKeys, true);
    },
  };
}

// Public API
export const Keyboard = {
  init: initKeyboard,
  initDialogOnly: initDialogOnly,
};
