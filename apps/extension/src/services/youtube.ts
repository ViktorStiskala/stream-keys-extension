// YouTube handler - service-specific configuration (restore-position only)

import { Handler } from '@/handlers';
import { Debug, Guard } from '@/core';

// __DEV__ is defined by vite config based on isDebugMode
declare const __DEV__: boolean;

// Initialize console forwarding in dev mode (must be early, before other logs)
if (__DEV__) {
  Debug.initConsoleForward();
}

// Initialization guard to prevent double execution
const shouldSkipInit = Guard.create('youtube');

/**
 * Get YouTube player element (the main video player, not preview)
 */
function getPlayer(): HTMLElement | null {
  return document.getElementById('movie_player');
}

/**
 * Get YouTube video element from main player (not inline preview player)
 * YouTube has two video elements:
 * - #movie_player video.video-stream - the main active video
 * - #inline-preview-player video.video-stream - thumbnail preview video
 */
function getVideo(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>('#movie_player video.video-stream');
}

/**
 * Initialize YouTube handler
 */
function initYouTubeHandler(): void {
  Handler.create({
    name: 'YouTube',

    getPlayer,

    // Select video inside main player only (not preview player)
    getVideo,

    // Return null - no keyboard/button handling needed (YouTube has its own)
    getButton: () => null,

    // Disable all features except restore-position
    features: {
      subtitles: false,
      keyboard: false,
      fullscreenOverlay: false,
      restorePosition: true, // Only feature enabled
    },

    // YouTube auto-resumes faster than other services
    positionTrackingTiming: {
      loadTimeCaptureDelay: 500,
    },
  });
}

// Public API
export const YouTubeHandler = {
  init: initYouTubeHandler,
  /** Internal functions exposed for testing only */
  _test: {
    getPlayer,
    getVideo,
  },
};

// Auto-initialize when script is loaded (with guard against double execution)
if (!shouldSkipInit()) {
  YouTubeHandler.init();
}
