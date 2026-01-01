// BBC iPlayer handler - service-specific configuration

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
const shouldSkipInit = Guard.create('bbc');

/**
 * Get shadow root using the patcher's stored reference
 * Falls back to native shadowRoot for open mode
 */
function getShadowRoot(element: Element | null): ShadowRoot | null {
  if (!element) return null;
  return window.__getShadowRoot?.(element) ?? element.shadowRoot ?? null;
}

/**
 * Traverse nested shadow DOM tree
 * BBC iPlayer's player has elements nested 4 levels deep in shadow roots:
 * document → toucan [shadow] → video-layout [shadow] → core-controls [shadow] → button [shadow]
 */
function getNestedShadow(root: Document | ShadowRoot, ...selectors: string[]): ShadowRoot | null {
  let current: ShadowRoot | null = null;
  let parent: Document | ShadowRoot = root;

  for (const selector of selectors) {
    const element = parent.querySelector(selector);
    current = getShadowRoot(element);
    if (!current) return null;
    parent = current;
  }
  return current;
}

/**
 * Get the player element (video-layout inside toucan's shadow root)
 * Used for focus handling
 */
function getPlayer(): HTMLElement | null {
  const toucan = document.querySelector('smp-toucan-player');
  const toucanShadow = getShadowRoot(toucan);
  if (!toucanShadow) return null;
  return toucanShadow.querySelector<HTMLElement>('smp-video-layout');
}

/**
 * Get video element from inside smp-playback Shadow DOM
 * Path: document → toucan [shadow] → playback [shadow] → video
 */
function getVideo(): HTMLVideoElement | null {
  const playbackShadow = getNestedShadow(document, 'smp-toucan-player', 'smp-playback');
  if (!playbackShadow) return null;
  return playbackShadow.querySelector<HTMLVideoElement>('video');
}

/**
 * Get a button from inside the deeply nested control elements
 * Path: document → toucan [shadow] → video-layout [shadow] → core-controls [shadow] → target [shadow] → button
 */
function getShadowButton(selector: string): HTMLButtonElement | null {
  const controlsShadow = getNestedShadow(
    document,
    'smp-toucan-player',
    'smp-video-layout',
    'smp-core-controls'
  );

  if (!controlsShadow) return null;

  const targetElement = controlsShadow.querySelector(selector);
  const targetShadow = getShadowRoot(targetElement);

  if (__DEV__ && targetElement) {
    // eslint-disable-next-line no-console
    console.log(`[StreamKeys] getShadowButton target:`, {
      targetExists: !!targetElement,
      targetShadowExists: !!targetShadow,
    });
  }

  if (!targetShadow) return null;
  return targetShadow.querySelector<HTMLButtonElement>('button');
}

/**
 * Key code to custom element selector mapping
 */
const keyMap: Record<string, string> = {
  Space: 'smp-play-pause-button',
  KeyF: 'smp-fullscreen-button',
};

/**
 * Get button for key code (pierces Shadow DOM)
 */
function getButton(keyCode: string): HTMLElement | null {
  const hostSelector = keyMap[keyCode];
  if (!hostSelector) return null;

  const button = getShadowButton(hostSelector);
  if (!button) {
    const buttonName = keyCode === 'Space' ? 'play/pause' : 'fullscreen';
    console.warn(`[StreamKeys] ${buttonName} button not found`);
  }
  return button;
}

/**
 * Get seek buttons for position history tracking (pierces Shadow DOM)
 */
function getSeekButtons() {
  return {
    backward: getShadowButton('smp-interval-button.backward_interval'),
    forward: getShadowButton('smp-interval-button.forward_interval'),
  };
}

/**
 * Get the smp-toggle element's shadow root
 * This is shared by both click and state functions
 * Path: toucan [shadow] → video-layout [shadow] → secondary-controls [shadow]
 *       → subtitles-settings-panel [shadow] → smp-toggle.subs_toggle [shadow]
 */
function getSubtitlesToggleShadow(): ShadowRoot | null {
  // Get to secondary-controls shadow
  const secondaryControlsShadow = getNestedShadow(
    document,
    'smp-toucan-player',
    'smp-video-layout',
    'smp-secondary-controls'
  );
  if (!secondaryControlsShadow) return null;

  // Get subtitles settings panel
  const settingsPanel = secondaryControlsShadow.querySelector('smp-subtitles-settings-panel');
  const settingsPanelShadow = getShadowRoot(settingsPanel);
  if (!settingsPanelShadow) return null;

  // Get the smp-toggle element and return its shadow root
  const subsToggle = settingsPanelShadow.querySelector('smp-toggle.subs_toggle');
  return getShadowRoot(subsToggle);
}

/**
 * Get the subtitles toggle element (.toggle)
 * This element has role="checkbox" with aria-checked for state,
 * and responds to pointer events for toggling
 */
function getSubtitlesToggle(): HTMLElement | null {
  const toggleShadow = getSubtitlesToggleShadow();
  if (!toggleShadow) return null;
  return toggleShadow.querySelector<HTMLElement>('.toggle');
}

/**
 * Click the subtitle toggle using pointer events
 * BBC's toggle doesn't respond to .click() but does respond to pointer events
 */
function clickSubtitleToggle(): void {
  const toggle = getSubtitlesToggle();
  if (!toggle) return;
  toggle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  toggle.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
}

/**
 * Subtitle config for BBC iPlayer
 * BBC only has a simple on/off toggle, no language selection
 * Click the host element (smp-toggle), read state from inner .toggle div
 */
const subtitleConfig = {
  getAvailable: (): SubtitleItem[] => {
    const toggle = getSubtitlesToggle();
    if (!toggle) return [];
    // Use "Captions: On" to match the "Captions: Off" banner when turning off
    return [{ label: 'Captions: On', element: toggle }];
  },

  getCurrentState: (): boolean => {
    const toggle = getSubtitlesToggle();
    if (!toggle) return false;
    return toggle.getAttribute('aria-checked') === 'true';
  },

  turnOff: (): void => {
    // Click the toggle using pointer events if currently on
    if (subtitleConfig.getCurrentState()) {
      clickSubtitleToggle();
    }
  },

  selectLanguage: (_item: SubtitleItem): void => {
    // Click the toggle using pointer events if currently off
    if (!subtitleConfig.getCurrentState()) {
      clickSubtitleToggle();
    }
  },
};

/**
 * Initialize BBC iPlayer handler
 */
function initBBCHandler(): void {
  Handler.create({
    name: 'BBC iPlayer',

    getPlayer,
    getVideo,
    getButton,
    getSeekButtons,

    setupPlayerFocus: (player: HTMLElement) => {
      player.setAttribute('tabindex', '-1');

      // Don't steal focus if already inside the player's shadow DOM tree
      // This prevents the subtitle dialog from closing when user hovers over player
      const activeElement = document.activeElement;
      if (activeElement) {
        // Get the root toucan player element
        const toucan = document.querySelector('smp-toucan-player');
        // If focus is on toucan or any element inside toucan's tree, don't disrupt
        if (toucan && (toucan === activeElement || toucan.contains(activeElement))) {
          return;
        }
      }

      player.focus();
    },

    getOverlayContainer: () => {
      return document.getElementById('tviplayer') || document.body;
    },

    subtitles: subtitleConfig,
  });
}

// Public API
export const BBCHandler = {
  init: initBBCHandler,
  /** Internal functions exposed for testing only */
  _test: {
    getPlayer,
    getVideo,
    getButton,
    getSeekButtons,
    getShadowButton,
    getShadowRoot,
    getNestedShadow,
    getSubtitlesToggleShadow,
    getSubtitlesToggle,
    clickSubtitleToggle,
    subtitles: subtitleConfig,
  },
};

// Auto-initialize when script is loaded (with guard against double execution)
if (!shouldSkipInit()) {
  BBCHandler.init();
}
