// HBO Max handler - service-specific configuration

import { Handler } from '@/handlers';
import { Debug, Guard } from '@/core';
import type { SubtitleItem } from '@/types';

// __DEV__ is defined by vite config based on isDebugMode
declare const __DEV__: boolean;

// Initialize console forwarding in dev mode (must be early, before other logs)
if (__DEV__) {
  Debug.initConsoleForward();
}

// Initialization guard to prevent double execution
const shouldSkipInit = Guard.create('hbomax');

/**
 * Get a button with primary and fallback selectors
 */
function getButtonElement(primarySelector: string, fallbackSelector: string): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(primarySelector) ||
    document.querySelector<HTMLElement>(fallbackSelector)
  );
}

/**
 * Get player element
 */
function getPlayer(): HTMLElement | null {
  return document.querySelector('div[data-testid="playerContainer"]');
}

/**
 * Get button for key code
 */
function getButtonForKey(keyCode: string): HTMLElement | null {
  if (keyCode === 'Space') {
    const button = getButtonElement(
      'button[data-testid="player-ux-play-pause-button"]',
      '[class^="ControlsFooterBottomMiddle"] button:nth-child(2)'
    );
    if (!button) console.warn('[StreamKeys] play/pause button not found');
    return button;
  }

  if (keyCode === 'KeyF') {
    const button = getButtonElement(
      'button[data-testid="player-ux-fullscreen-button"]',
      '[class^="ControlsFooterBottomRight"] button:last-child'
    );
    if (!button) console.warn('[StreamKeys] fullscreen button not found');
    return button;
  }

  return null;
}

// Subtitle config (extracted for testing)
const subtitleConfig = {
  getAvailable: (): SubtitleItem[] => {
    const buttons = document.querySelectorAll<HTMLButtonElement>(
      'button[data-testid="player-ux-text-track-button"]'
    );
    const results: SubtitleItem[] = [];

    buttons.forEach((button, index) => {
      // Skip the first button (Off option)
      if (index === 0) return;

      const label =
        button.getAttribute('aria-label') || button.querySelector('p')?.textContent || '';

      results.push({
        label: label.trim(),
        element: button,
      });
    });

    return results;
  },

  getCurrentState: (): boolean => {
    // First button is the "Off" option - if it's checked, subtitles are off
    const offButton = document.querySelector<HTMLButtonElement>(
      'button[data-testid="player-ux-text-track-button"]'
    );
    return offButton !== null && offButton.getAttribute('aria-checked') !== 'true';
  },

  turnOff: (): void => {
    // Click the first button (Off option)
    const offButton = document.querySelector<HTMLButtonElement>(
      'button[data-testid="player-ux-text-track-button"]'
    );
    offButton?.click();
  },

  selectLanguage: (item: SubtitleItem): void => {
    item.element.click();
  },
};

/**
 * Initialize HBO Max handler
 */
function initHboMaxHandler(): void {
  Handler.create({
    name: 'HBO Max',

    getPlayer,

    getSeekButtons: () => ({
      backward: document.querySelector<HTMLElement>(
        'button[data-testid="player-ux-skip-back-button"]'
      ),
      forward: document.querySelector<HTMLElement>(
        'button[data-testid="player-ux-skip-forward-button"]'
      ),
    }),

    getButton: getButtonForKey,

    setupPlayerFocus: (_player: HTMLElement) => {
      const overlay = document.querySelector<HTMLElement>('#overlay-root');
      overlay?.focus();
    },

    getOverlayContainer: () => {
      return document.getElementById('app-root') || document.body;
    },

    subtitles: subtitleConfig,
  });
}

// Public API
export const HboMaxHandler = {
  init: initHboMaxHandler,
  /** Internal functions exposed for testing only */
  _test: {
    getPlayer,
    getButton: getButtonForKey,
    subtitles: subtitleConfig,
  },
};

// Auto-initialize when script is loaded (with guard against double execution)
if (!shouldSkipInit()) {
  HboMaxHandler.init();
}
