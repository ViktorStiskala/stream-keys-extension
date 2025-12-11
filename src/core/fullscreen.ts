// Fullscreen handling utilities

import { Overlay } from '@/ui/overlay';
import { Focus, type FocusConfig } from './focus';

export interface FullscreenConfig extends FocusConfig {
  getOverlayContainer?: () => HTMLElement;
}

export interface FullscreenState {
  currentFullscreenElement: Element | null;
  wasInFullscreen: boolean;
}

/**
 * Get the current fullscreen element (handles webkit prefix)
 */
function getFullscreenElement(): Element | null {
  return (
    document.fullscreenElement ||
    (document as { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
    null
  );
}

/**
 * Create fullscreen change handler
 */
function createFullscreenHandler(
  config: FullscreenConfig,
  state: FullscreenState,
  onKeyDown: (e: KeyboardEvent) => void
): () => void {
  return () => {
    const fullscreenEl = getFullscreenElement();

    // Remove listener from previous fullscreen element
    if (state.currentFullscreenElement) {
      state.currentFullscreenElement.removeEventListener(
        'keydown',
        onKeyDown as EventListener,
        true
      );
      state.currentFullscreenElement = null;
    }

    if (fullscreenEl) {
      // Entering fullscreen
      state.currentFullscreenElement = fullscreenEl;
      state.currentFullscreenElement.addEventListener('keydown', onKeyDown as EventListener, true);
      setTimeout(() => Focus.player(config), 100);
      state.wasInFullscreen = true;
    } else if (state.wasInFullscreen) {
      // Exiting fullscreen
      state.wasInFullscreen = false;
      setTimeout(() => {
        const container = config.getOverlayContainer?.();
        Overlay.createClick(() => Focus.player(config), container);
        Focus.player(config);
        console.info('[StreamKeys] Fullscreen exit: Click to focus overlay added');
      }, 100);
    }
  };
}

/**
 * Set up fullscreen change listeners
 */
function setupFullscreenListeners(handler: () => void): () => void {
  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);

  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
  };
}

// Public API
export const Fullscreen = {
  getElement: getFullscreenElement,
  createHandler: createFullscreenHandler,
  setupListeners: setupFullscreenListeners,
};
