// Restore Position feature - main module

import type { CleanupFn } from '@/types';
import { isPositionHistoryEnabled } from '@/core/settings';
import { getVideoElement as getVideo } from '@/core/video';
import {
  createPositionHistoryState,
  recordPositionBeforeSeek,
  setupVideoTracking,
  type PositionHistoryState,
} from './history';
import {
  createRestoreDialog,
  closeRestoreDialog,
  handleRestoreDialogKeys,
  isDialogOpen,
} from './dialog';

export interface RestorePositionConfig {
  getPlayer: () => HTMLElement | null;
  /** Custom video element selector for services with multiple video elements */
  getVideo?: () => HTMLVideoElement | null;
  /** Custom playback time getter for services where video.currentTime is unreliable */
  getPlaybackTime?: () => number | null;
}

export interface RestorePositionAPI {
  /** Open the restore dialog */
  openDialog: () => void;
  /** Close the restore dialog */
  closeDialog: () => void;
  /** Check if dialog is open */
  isDialogOpen: () => boolean;
  /** Record position before seek (for keyboard seeks) */
  recordBeforeSeek: (preSeekTime: number | undefined) => void;
  /** Mark that a keyboard/button seek is happening */
  setKeyboardSeek: (value: boolean) => void;
  /** Handle keyboard events for the dialog */
  handleDialogKeys: (e: KeyboardEvent) => boolean;
  /** Get the history state (for testing/debugging) */
  getState: () => PositionHistoryState;
  /** Cleanup resources */
  cleanup: CleanupFn;
}

/**
 * Initialize the Restore Position feature
 */
export function initRestorePosition(config: RestorePositionConfig): RestorePositionAPI {
  const state = createPositionHistoryState();
  let videoCleanup: CleanupFn | null = null;
  let earlySetupInterval: ReturnType<typeof setInterval> | null = null;

  const getVideoElement = () => getVideo(config.getPlayer, config.getVideo);

  // Setup video listeners
  const setupVideoListeners = () => {
    const video = getVideoElement();
    if (video && !video._streamKeysSeekListenerAdded) {
      videoCleanup = setupVideoTracking(video, state, getVideoElement, config.getPlaybackTime);
    }
  };

  // Early setup for fast video detection
  const earlySetup = () => {
    setupVideoListeners();
    const video = getVideoElement();
    if (video && !video.seeking) {
      video._lastKnownTime = video.currentTime;
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
      if (isPositionHistoryEnabled()) {
        createRestoreDialog(state, getVideoElement, config.getPlaybackTime);
      }
    },
    closeDialog: closeRestoreDialog,
    isDialogOpen,
    recordBeforeSeek: (preSeekTime) => {
      recordPositionBeforeSeek(state, preSeekTime);
    },
    setKeyboardSeek: (value) => {
      state.isKeyboardOrButtonSeek = value;
    },
    handleDialogKeys: (e) => {
      return handleRestoreDialogKeys(e, state, getVideoElement, config.getPlaybackTime);
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
      closeRestoreDialog();
    },
  };
}

// Re-export types
export type { PositionHistoryState } from './history';
