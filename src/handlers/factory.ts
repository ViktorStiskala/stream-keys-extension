// Handler factory - creates handlers with composable features

import type { CleanupFn } from '@/types';
import {
  createMouseMoveHandler,
  createFullscreenHandler,
  setupFullscreenListeners,
  setupPlayer,
  createPlayerSetupInterval,
  type FullscreenState,
  type PlayerState,
} from '@/core';
import {
  initRestorePosition,
  initSubtitles,
  initKeyboard,
  type RestorePositionAPI,
  type SubtitlesAPI,
} from '@/features';
import type { HandlerConfig, HandlerAPI } from './types';

/**
 * Create a handler with composable features
 */
export function createHandler(config: HandlerConfig): HandlerAPI {
  console.info(`[StreamKeys] ${config.name} extension loaded at ${new Date().toISOString()}`);

  const cleanupFns: CleanupFn[] = [];

  // Determine which features are enabled (all enabled by default)
  const features = {
    subtitles: config.features?.subtitles !== false && !!config.subtitles,
    restorePosition: config.features?.restorePosition !== false,
    keyboard: config.features?.keyboard !== false,
    fullscreenOverlay: config.features?.fullscreenOverlay !== false,
  };

  // Initialize features
  let restorePositionAPI: RestorePositionAPI | undefined;
  let subtitlesAPI: SubtitlesAPI | undefined;

  if (features.restorePosition) {
    restorePositionAPI = initRestorePosition({
      getPlayer: config.getPlayer,
    });
    cleanupFns.push(restorePositionAPI.cleanup);
  }

  if (features.subtitles && config.subtitles) {
    subtitlesAPI = initSubtitles({
      subtitles: config.subtitles,
    });
    cleanupFns.push(subtitlesAPI.cleanup);
  }

  // Initialize keyboard handling
  let keyboardHandler: ((e: KeyboardEvent) => void) | undefined;

  if (features.keyboard) {
    const keyboardAPI = initKeyboard({
      getPlayer: config.getPlayer,
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
  const mouseMoveHandler = createMouseMoveHandler(focusConfig);

  // Fullscreen handling
  if (features.fullscreenOverlay) {
    const fullscreenState: FullscreenState = {
      currentFullscreenElement: null,
      wasInFullscreen: false,
    };

    const fullscreenHandler = createFullscreenHandler(
      {
        ...focusConfig,
        getOverlayContainer: config.getOverlayContainer,
      },
      fullscreenState,
      keyboardHandler || (() => {})
    );

    const cleanupFullscreen = setupFullscreenListeners(fullscreenHandler);
    cleanupFns.push(cleanupFullscreen);
  }

  // Player setup
  const playerState: PlayerState = {
    keyListenerAdded: false,
  };

  const playerSetupConfig = {
    getPlayer: config.getPlayer,
    onPlayerSetup: config.onPlayerSetup,
    onKeyDown: keyboardHandler || (() => {}),
    onMouseMove: mouseMoveHandler,
  };

  // Initial setup
  setupPlayer(playerSetupConfig, playerState);

  // Periodic setup
  const cleanupPlayerInterval = createPlayerSetupInterval(playerSetupConfig, playerState);
  cleanupFns.push(cleanupPlayerInterval);

  return {
    cleanup: () => {
      cleanupFns.forEach((fn) => fn());
    },
  };
}
