// Handler factory - creates handlers with composable features

import type { CleanupFn } from '@/types';
import { Focus, Fullscreen, Player, Video, type FullscreenState, type PlayerState } from '@/core';
import {
  RestorePosition,
  Subtitles,
  Keyboard,
  type RestorePositionAPI,
  type SubtitlesAPI,
} from '@/features';
import type { HandlerConfig, HandlerAPI } from './types';

/**
 * Create a handler with composable features
 */
function createHandler(config: HandlerConfig): HandlerAPI {
  console.info(`[StreamKeys] ${config.name} extension loaded at ${new Date().toISOString()}`);

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

  // Initialize features
  let restorePositionAPI: RestorePositionAPI | undefined;
  let subtitlesAPI: SubtitlesAPI | undefined;

  if (features.restorePosition) {
    restorePositionAPI = RestorePosition.init({ getVideoElement });
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
    const keyboardAPI = Keyboard.init({
      getVideoElement,
      getButton: config.getButton,
      restorePosition: restorePositionAPI,
      subtitles: subtitlesAPI,
    });
    keyboardHandler = keyboardAPI.handleKey;
    cleanupFns.push(keyboardAPI.cleanup);
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
