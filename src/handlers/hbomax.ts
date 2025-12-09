// HBO Max handler - service-specific configuration

import { createHandler } from './factory';
import type { SubtitleItem } from '@/types';

// Guard attribute - uses HTML element attribute for atomic check-and-set
const GUARD_ATTR = 'data-streamkeys-hbomax';

function shouldSkipInit(): boolean {
  // Use HTML attribute as guard - atomic check across script contexts
  const html = document.documentElement;
  if (html.hasAttribute(GUARD_ATTR)) {
    return true;
  }
  html.setAttribute(GUARD_ATTR, '1');
  return false;
}

/**
 * Get a button with primary and fallback selectors
 */
function getButton(primarySelector: string, fallbackSelector: string): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(primarySelector) ||
    document.querySelector<HTMLElement>(fallbackSelector)
  );
}

/**
 * Initialize HBO Max handler
 */
export function initHboMaxHandler(): void {
  createHandler({
    name: 'HBO Max',

    getPlayer: () => document.querySelector('div[data-testid="playerContainer"]'),

    getButton: (keyCode: string): HTMLElement | null => {
      if (keyCode === 'Space') {
        const button = getButton(
          'button[data-testid="player-ux-play-pause-button"]',
          '[class^="ControlsFooterBottomMiddle"] button:nth-child(2)'
        );
        if (!button) console.warn('[StreamKeys] play/pause button not found');
        return button;
      }

      if (keyCode === 'KeyF') {
        const button = getButton(
          'button[data-testid="player-ux-fullscreen-button"]',
          '[class^="ControlsFooterBottomRight"] button:last-child'
        );
        if (!button) console.warn('[StreamKeys] fullscreen button not found');
        return button;
      }

      return null;
    },

    setupPlayerFocus: (_player: HTMLElement) => {
      const overlay = document.querySelector<HTMLElement>('#overlay-root');
      overlay?.focus();
    },

    getOverlayContainer: () => {
      return document.getElementById('app-root') || document.body;
    },

    subtitles: {
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
    },
  });
}

// Auto-initialize when script is loaded (with guard against double execution)
if (!shouldSkipInit()) {
  initHboMaxHandler();
}
