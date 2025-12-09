// Disney+ handler - service-specific configuration

import { createHandler } from './factory';
import type { SubtitleItem } from '@/types';

// Guard attribute - uses HTML element attribute for atomic check-and-set
const GUARD_ATTR = 'data-streamkeys-disney';

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
 * Get a button from Disney+'s Shadow DOM
 */
function getShadowRootButton(selector: string): HTMLButtonElement | null {
  const element = document.body.querySelector(selector);
  if (!element?.shadowRoot) return null;
  return element.shadowRoot.querySelector<HTMLButtonElement>('info-tooltip button');
}

/**
 * Remove outline from player and video elements
 */
function removeOutline(): void {
  const player = document.body.querySelector('disney-web-player') as HTMLElement | null;
  const video = player?.querySelector('video');
  player?.style?.setProperty('outline', '0', 'important');
  video?.style?.setProperty('outline', '0', 'important');
}

/**
 * Key code to button selector mapping
 */
const keyMap: Record<string, string> = {
  Space: 'toggle-play-pause',
  KeyF: 'toggle-fullscreen',
  ArrowLeft: 'quick-rewind',
  ArrowRight: 'quick-fast-forward',
};

/**
 * Initialize Disney+ handler
 */
export function initDisneyHandler(): void {
  createHandler({
    name: 'Disney+',

    getPlayer: () => document.body.querySelector('disney-web-player'),

    getButton: (keyCode: string): HTMLElement | null => {
      const selector = keyMap[keyCode];
      if (!selector) return null;

      const button = getShadowRootButton(selector);
      if (!button) {
        const buttonName = keyCode === 'Space' ? 'play/pause' : 'fullscreen';
        console.warn(`[StreamKeys] ${buttonName} button not found`);
      }
      return button;
    },

    setupPlayerFocus: (player: HTMLElement) => {
      player.setAttribute('tabindex', '-1');
      player.focus();
      removeOutline();
    },

    onPlayerSetup: (player: HTMLElement) => {
      removeOutline();
      player.setAttribute('tabindex', '-1');
    },

    subtitles: {
      getAvailable: (): SubtitleItem[] => {
        const labels = document.querySelectorAll<HTMLLabelElement>(
          '#subtitleTrackPicker label.picker-item'
        );
        const results: SubtitleItem[] = [];

        labels.forEach((label) => {
          // Skip the "off" option
          if (label.getAttribute('for') === 'subtitleTrackPicker-off') return;
          results.push({
            label: label.textContent?.trim() || '',
            element: label,
            inputId: label.getAttribute('for') || undefined,
          });
        });

        return results;
      },

      getCurrentState: (): boolean => {
        const offRadio = document.querySelector<HTMLInputElement>('#subtitleTrackPicker-off');
        // Subtitles are ON if the "off" radio is NOT checked
        return offRadio !== null && !offRadio.checked;
      },

      turnOff: (): void => {
        const offRadio = document.querySelector<HTMLInputElement>('#subtitleTrackPicker-off');
        offRadio?.click();
      },

      selectLanguage: (item: SubtitleItem): void => {
        if (item.inputId) {
          const input = document.querySelector<HTMLInputElement>(`#${item.inputId}`);
          input?.click();
        }
      },
    },
  });
}

// Auto-initialize when script is loaded (with guard against double execution)
if (!shouldSkipInit()) {
  initDisneyHandler();
}
