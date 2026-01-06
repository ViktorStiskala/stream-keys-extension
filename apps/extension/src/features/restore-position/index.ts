// Restore Position feature - main module

import type { CleanupFn, StreamKeysVideoElement } from '@/types';
import { Settings } from '@/core/settings';
import { PositionHistory, type PositionHistoryState, type TrackingTimingConfig } from './history';
import { RestoreDialog } from './dialog';

export interface RestorePositionConfig {
  /** Get the augmented video element (with _streamKeysGetPlaybackTime method) */
  getVideoElement: () => StreamKeysVideoElement | null;
  /**
   * Seek to a specific time using service-specific UI (e.g., clicking timeline).
   * If provided, used instead of direct video.currentTime assignment.
   */
  seekToTime?: (time: number, duration: number) => boolean;
  /** Optional timing configuration for position tracking settling delays */
  timing?: TrackingTimingConfig;
  /** Custom container for restore dialog (for fullscreen in Shadow DOM environments) */
  getDialogContainer?: () => HTMLElement | null;
}

export interface RestorePositionAPI {
  /** Open the restore dialog */
  openDialog: () => void;
  /** Close the restore dialog */
  closeDialog: () => void;
  /** Check if dialog is open */
  isDialogOpen: () => boolean;
  /** Record position before seek (for keyboard seeks). Returns true if debounced. */
  recordBeforeSeek: (preSeekTime: number | undefined) => boolean;
  /** Mark that a keyboard/button seek is happening */
  setKeyboardSeek: (value: boolean) => void;
  /** Handle keyboard events for the dialog */
  handleDialogKeys: (e: KeyboardEvent) => boolean;
  /** Save user position (S key). Returns saved entry or null if blocked. */
  saveUserPosition: (time: number) => void;
  /** Get the history state (for testing/debugging) */
  getState: () => PositionHistoryState;
  /** Cleanup resources */
  cleanup: CleanupFn;
}

/**
 * Initialize the Restore Position feature
 */
function initRestorePosition(config: RestorePositionConfig): RestorePositionAPI {
  const state = PositionHistory.createState();
  let videoCleanup: CleanupFn | null = null;
  let earlySetupInterval: ReturnType<typeof setInterval> | null = null;

  const { getVideoElement, seekToTime, timing, getDialogContainer } = config;

  // Track current video to detect when a new video starts
  // We track both the element AND the source because:
  // - HBO Max: new video = new DOM element
  // - Disney+: may reuse element but change src (blob URL)
  let currentVideo: StreamKeysVideoElement | null = null;
  let currentVideoSrc: string | null = null;

  // Setup video listeners
  const setupVideoListeners = () => {
    const video = getVideoElement();
    if (!video) return;

    const videoSrc = video.src || video.currentSrc || null;
    const isNewVideo = currentVideo !== video || (videoSrc && currentVideoSrc !== videoSrc);

    if (isNewVideo && currentVideo !== null) {
      // New video detected - reset history from previous video
      console.info('[StreamKeys] New video detected, position history cleared');

      // Clean up old video tracking
      if (videoCleanup) {
        videoCleanup();
        videoCleanup = null;
      }

      // Reset state for new video
      PositionHistory.reset(state);

      // Clear the flag on old video so new video can be set up
      if (currentVideo._streamKeysSeekListenerAdded) {
        currentVideo._streamKeysSeekListenerAdded = false;
      }
    }

    // Update tracking references
    currentVideo = video;
    currentVideoSrc = videoSrc;

    // Set up tracking if not already done
    if (!video._streamKeysSeekListenerAdded) {
      videoCleanup = PositionHistory.setupTracking(video, state, getVideoElement, timing);
    }
  };

  // Early setup for fast video detection
  const earlySetup = () => {
    setupVideoListeners();
    const video = getVideoElement();
    if (video && !video.seeking) {
      video._streamKeysLastKnownTime = video._streamKeysGetPlaybackTime?.() ?? video.currentTime;
    }
  };

  // Run setup immediately
  earlySetup();

  // Run frequently during first few seconds
  earlySetupInterval = setInterval(earlySetup, 100);
  setTimeout(() => {
    if (earlySetupInterval) {
      clearInterval(earlySetupInterval);
      earlySetupInterval = null;
    }
  }, 5000);

  // Periodic setup
  const setupInterval = setInterval(() => {
    setupVideoListeners();
  }, 1000);

  return {
    openDialog: () => {
      if (Settings.isPositionHistoryEnabled()) {
        RestoreDialog.create(state, getVideoElement, seekToTime, getDialogContainer);
      }
    },
    closeDialog: RestoreDialog.close,
    isDialogOpen: RestoreDialog.isOpen,
    recordBeforeSeek: (preSeekTime) => {
      return PositionHistory.record(state, preSeekTime);
    },
    setKeyboardSeek: (value) => {
      state.isKeyboardOrButtonSeek = value;
    },
    handleDialogKeys: (e) => {
      return RestoreDialog.handleKeys(e, state, getVideoElement, seekToTime);
    },
    saveUserPosition: (time) => {
      PositionHistory.saveUserPosition(state, time);
    },
    getState: () => state,
    cleanup: () => {
      if (videoCleanup) {
        videoCleanup();
      }
      if (earlySetupInterval) {
        clearInterval(earlySetupInterval);
      }
      clearInterval(setupInterval);
      RestoreDialog.close();
    },
  };
}

// Public API
export const RestorePosition = {
  init: initRestorePosition,
};

// Re-export types
export type { PositionHistoryState, TrackingTimingConfig } from './history';
