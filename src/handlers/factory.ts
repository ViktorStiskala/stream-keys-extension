// Handler factory - creates handlers with composable features

import type { CleanupFn } from '@/types';
import {
  Debug,
  Focus,
  Fullscreen,
  Player,
  Settings,
  Video,
  type FullscreenState,
  type PlayerState,
} from '@/core';

// __DEV__ is defined by vite config based on isWatch
declare const __DEV__: boolean;
import {
  RestorePosition,
  Subtitles,
  Keyboard,
  type RestorePositionAPI,
  type SubtitlesAPI,
} from '@/features';
import type { HandlerConfig, HandlerAPI } from './types';

/** Interval for Media Session handler setup (ms) */
const MEDIA_SESSION_SETUP_INTERVAL = 5000;

/** Interval for UI button interception setup (ms) */
const BUTTON_INTERCEPTION_INTERVAL = 2000;

/**
 * Timeout for resetting keyboard seek flag in Media Session and button handlers (ms).
 * Uses a simple timeout (not 'seeked' event) because these handlers fire once per action
 * and don't need precise seek completion detection.
 */
const POSITION_TRACK_TIMEOUT_MS = 500;

/**
 * Create a handler with composable features
 */
function createHandler(config: HandlerConfig): HandlerAPI {
  console.info(`[StreamKeys] ${config.name} extension loaded at ${new Date().toISOString()}`);

  if (__DEV__) {
    const settings = Settings.get();
    // eslint-disable-next-line no-console
    console.log('[StreamKeys] Settings:', {
      captureMediaKeys: settings.captureMediaKeys,
      customSeekEnabled: settings.customSeekEnabled,
      seekTime: settings.seekTime,
      positionHistoryEnabled: settings.positionHistoryEnabled,
      subtitleLanguages: settings.subtitleLanguages,
    });
  }

  const cleanupFns: CleanupFn[] = [];

  // Determine which features are enabled (all enabled by default)
  const features = {
    subtitles: config.features?.subtitles !== false && !!config.subtitles,
    restorePosition: config.features?.restorePosition !== false,
    keyboard: config.features?.keyboard !== false,
    fullscreenOverlay: config.features?.fullscreenOverlay !== false,
  };

  // Create video getter once - all features share this
  const getVideoElement = Video.createGetter({
    getPlayer: config.getPlayer,
    getVideo: config.getVideo,
    getPlaybackTime: config.getPlaybackTime,
    getDuration: config.getDuration,
  });

  // Default seek implementation using video.currentTime
  const defaultSeekByDelta = (video: HTMLVideoElement, delta: number) => {
    video.currentTime = Math.max(
      0,
      Math.min(video.duration || Infinity, video.currentTime + delta)
    );
  };
  const seekByDelta = config.seekByDelta ?? defaultSeekByDelta;

  // Initialize features
  let restorePositionAPI: RestorePositionAPI | undefined;
  let subtitlesAPI: SubtitlesAPI | undefined;

  if (features.restorePosition) {
    restorePositionAPI = RestorePosition.init({
      getVideoElement,
      seekToTime: config.seekToTime,
      timing: config.positionTrackingTiming,
      getDialogContainer: config.getDialogContainer,
    });
    cleanupFns.push(restorePositionAPI.cleanup);
  }

  if (features.subtitles && config.subtitles) {
    subtitlesAPI = Subtitles.init({
      subtitles: config.subtitles,
    });
    cleanupFns.push(subtitlesAPI.cleanup);
  }

  // Initialize keyboard handling
  let keyboardHandler: ((e: KeyboardEvent) => void) | undefined;

  if (features.keyboard) {
    // Full keyboard handling (arrow keys, space, etc.)
    const keyboardAPI = Keyboard.init({
      getVideoElement,
      getButton: config.getButton,
      restorePosition: restorePositionAPI,
      subtitles: subtitlesAPI,
      seekByDelta,
    });
    keyboardHandler = keyboardAPI.handleKey;
    cleanupFns.push(keyboardAPI.cleanup);
  } else if (features.restorePosition && restorePositionAPI) {
    // Lightweight keyboard handler for restore dialog only (R key + dialog keys)
    // Used when keyboard feature is disabled but restorePosition is enabled
    const dialogKeyboardAPI = Keyboard.initDialogOnly({
      restorePosition: restorePositionAPI,
    });
    keyboardHandler = dialogKeyboardAPI.handleKey;
    cleanupFns.push(dialogKeyboardAPI.cleanup);
  }

  // Create focus config
  const focusConfig = {
    getPlayer: config.getPlayer,
    setupPlayerFocus: config.setupPlayerFocus,
  };

  // Create mouse move handler
  const mouseMoveHandler = Focus.createMouseMoveHandler(focusConfig);

  // Fullscreen handling
  if (features.fullscreenOverlay) {
    const fullscreenState: FullscreenState = {
      currentFullscreenElement: null,
      wasInFullscreen: false,
    };

    const fullscreenHandler = Fullscreen.createHandler(
      {
        ...focusConfig,
        getOverlayContainer: config.getOverlayContainer,
      },
      fullscreenState,
      keyboardHandler || (() => {})
    );

    const cleanupFullscreen = Fullscreen.setupListeners(fullscreenHandler);
    cleanupFns.push(cleanupFullscreen);
  }

  // Player setup
  const playerState: PlayerState = {
    attachedPlayer: null,
  };

  const playerSetupConfig = {
    getPlayer: config.getPlayer,
    onPlayerSetup: config.onPlayerSetup,
    onKeyDown: keyboardHandler || (() => {}),
    onMouseMove: mouseMoveHandler,
  };

  // Initial setup
  Player.setup(playerSetupConfig, playerState);

  // Periodic setup
  const cleanupPlayerInterval = Player.createSetupInterval(playerSetupConfig, playerState);
  cleanupFns.push(cleanupPlayerInterval);

  /**
   * Track position before seeking for position history.
   * Uses a simple timeout (not 'seeked' event) because Media Session and button handlers
   * fire once per action and don't need precise seek completion detection.
   *
   * IMPORTANT: We only extend the timeout when the save is debounced (rapid clicks).
   * - First click: saves position, schedules short timeout to reset flag
   * - Subsequent clicks (debounced): extends the timeout to keep flag true
   * This prevents handleSeeking from saving duplicate positions when the user
   * clicks rapidly.
   */
  let positionTrackTimeoutId: ReturnType<typeof setTimeout> | null = null;

  const trackPositionBeforeSeek = (video: HTMLVideoElement | null) => {
    if (!restorePositionAPI) return;

    restorePositionAPI.setKeyboardSeek(true);
    const currentTime = (video as ReturnType<typeof getVideoElement>)?._streamKeysGetStableTime?.();

    let wasDebounced = false;
    if (currentTime !== undefined) {
      wasDebounced = restorePositionAPI.recordBeforeSeek(currentTime);
    }

    // Only extend timeout if this click was debounced (rapid clicking)
    // For non-debounced saves (first click), use a fresh timeout
    if (wasDebounced && positionTrackTimeoutId !== null) {
      clearTimeout(positionTrackTimeoutId);
    }

    // Schedule reset - if debounced, this extends the window; otherwise starts fresh
    positionTrackTimeoutId = setTimeout(() => {
      restorePositionAPI!.setKeyboardSeek(false);
      positionTrackTimeoutId = null;
    }, POSITION_TRACK_TIMEOUT_MS);
  };

  // Media Session handlers (when capture enabled AND keyboard feature enabled)
  // Skip for handlers that disable keyboard (like YouTube) to avoid conflicting with native controls
  if (features.keyboard && Settings.isMediaKeysCaptureEnabled() && navigator.mediaSession) {
    console.info(`[StreamKeys] Media keys captured for ${config.name} player`);

    const setupMediaSession = (logEnabled: boolean) => {
      try {
        navigator.mediaSession.setActionHandler('play', () => {
          if (__DEV__) Debug.action('Media key: Play');
          getVideoElement()?.play();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          if (__DEV__) Debug.action('Media key: Pause');
          getVideoElement()?.pause();
        });

        navigator.mediaSession.setActionHandler('previoustrack', () => {
          const video = getVideoElement();
          if (!video) return;

          const delta = Settings.isCustomSeekEnabled() ? Settings.getSeekTime() : 10;
          if (__DEV__) Debug.action('Media key: Previous track', `seek backward ${delta}s`);

          trackPositionBeforeSeek(video);
          seekByDelta(video, -delta);
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => {
          const video = getVideoElement();
          if (!video) return;

          const delta = Settings.isCustomSeekEnabled() ? Settings.getSeekTime() : 10;
          if (__DEV__) Debug.action('Media key: Next track', `seek forward ${delta}s`);

          trackPositionBeforeSeek(video);
          seekByDelta(video, delta);
        });
        if (__DEV__ && logEnabled) {
          // eslint-disable-next-line no-console
          console.log('[StreamKeys] Media Session handlers set up');
        }
      } catch {
        /* ignore unsupported actions */
      }
    };

    // Setup immediately and then periodically (to override streaming service)
    setupMediaSession(true);
    const mediaSessionIntervalId = setInterval(
      () => setupMediaSession(false),
      MEDIA_SESSION_SETUP_INTERVAL
    );
    cleanupFns.push(() => clearInterval(mediaSessionIntervalId));
  }

  // UI Button interception (for position history + custom seek)
  // Custom seek override only works when using default seekByDelta (direct video.currentTime)
  const canOverrideButtonSeek = !config.seekByDelta;

  if (config.getSeekButtons) {
    const interceptedButtons = new WeakSet<HTMLElement>();

    const setupButtonInterception = () => {
      const buttons = config.getSeekButtons!();

      const interceptButton = (button: HTMLElement | null, direction: 'backward' | 'forward') => {
        if (!button || interceptedButtons.has(button)) return;
        interceptedButtons.add(button);

        // Use pointerdown instead of click to capture position BEFORE the service's
        // event handlers fire. Many services use mousedown/pointerdown to trigger seeks,
        // so by the time 'click' fires, the seek has already started.
        button.addEventListener(
          'pointerdown',
          (e) => {
            const seekTime = Settings.isCustomSeekEnabled() ? Settings.getSeekTime() : 10;
            if (__DEV__) Debug.action(`UI: ${direction} button`, `seek ${seekTime}s`);

            const video = getVideoElement();
            trackPositionBeforeSeek(video);

            // Override button seek only if custom seek enabled AND using default seekByDelta
            // (Disney+ provides custom seekByDelta, so custom seek time doesn't apply)
            if (Settings.isCustomSeekEnabled() && canOverrideButtonSeek && video) {
              e.stopImmediatePropagation();
              e.preventDefault();
              const delta =
                direction === 'backward' ? -Settings.getSeekTime() : Settings.getSeekTime();
              seekByDelta(video, delta);
            }
          },
          true
        );
      };

      interceptButton(buttons.backward, 'backward');
      interceptButton(buttons.forward, 'forward');
    };

    setupButtonInterception();
    const buttonInterceptionIntervalId = setInterval(
      setupButtonInterception,
      BUTTON_INTERCEPTION_INTERVAL
    );
    cleanupFns.push(() => clearInterval(buttonInterceptionIntervalId));
  }

  return {
    cleanup: () => {
      cleanupFns.forEach((fn) => fn());
    },
  };
}

// Public API
export const Handler = {
  create: createHandler,
};
