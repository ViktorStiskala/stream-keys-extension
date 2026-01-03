// Disney+ handler - service-specific configuration

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
const shouldSkipInit = Guard.create('disney');

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
 * Get Disney+ video element.
 * Disney+ has two video elements - one hidden, one active.
 * In non-fullscreen mode: video.hive-video
 * In fullscreen mode: video#hivePlayer1.btm-media-client-element (no hive-video class)
 */
function getDisneyVideo(): HTMLVideoElement | null {
  const player = document.body.querySelector('disney-web-player');
  if (!player) return null;

  // Primary: video with hive-video class (non-fullscreen)
  const hiveVideo = player.querySelector<HTMLVideoElement>('video.hive-video');
  if (hiveVideo) return hiveVideo;

  // Fallback: video by stable ID (fullscreen mode)
  return player.querySelector<HTMLVideoElement>('#hivePlayer1');
}

// Cache for Disney progress bar element
let disneyProgressBarCache: { element: Element | null; lastCheck: number } | null = null;
const DISNEY_CACHE_TTL = 5000; // Re-check every 5 seconds
let disneyProgressBarLoggedOnce = false;

/**
 * Get a value from Disney+'s progress bar aria attribute.
 * Disney+ uses MediaSource Extensions where video.currentTime/duration are buffer-relative.
 * The real values are in the progress bar's aria-valuenow (time) and aria-valuemax (duration).
 */
function getDisneyAriaValue(attribute: 'aria-valuenow' | 'aria-valuemax'): number | null {
  const now = Date.now();

  // Helper to get value from progress bar thumb
  const getValueFromThumb = (thumb: Element | null): number | null => {
    if (!thumb) return null;
    const value = thumb.getAttribute(attribute);
    if (value) {
      const seconds = parseInt(value, 10);
      if (!isNaN(seconds) && seconds >= 0) {
        return seconds;
      }
    }
    return null;
  };

  // Try to use cached element first (if still connected to DOM)
  // Disney+ can rebuild its UI (e.g., fullscreen transitions) which detaches elements
  if (
    disneyProgressBarCache &&
    now - disneyProgressBarCache.lastCheck < DISNEY_CACHE_TTL &&
    disneyProgressBarCache.element?.isConnected
  ) {
    const value = getValueFromThumb(disneyProgressBarCache.element);
    if (value !== null) {
      return value;
    }
  }

  // Find progress-bar element and access its shadow DOM
  const progressBar = document.querySelector('progress-bar');
  if (progressBar?.shadowRoot) {
    const thumb = progressBar.shadowRoot.querySelector('.progress-bar__thumb');
    const value = getValueFromThumb(thumb);
    if (value !== null) {
      // Cache the thumb element
      disneyProgressBarCache = { element: thumb, lastCheck: now };
      if (!disneyProgressBarLoggedOnce) {
        disneyProgressBarLoggedOnce = true;
        console.info('[StreamKeys] Found Disney progress bar');
      }
      return value;
    }
  }

  // Update cache to indicate we didn't find it
  disneyProgressBarCache = { element: null, lastCheck: now };
  return null;
}

/**
 * Get Disney+ actual playback time from progress bar.
 */
function getDisneyPlaybackTime(): number | null {
  return getDisneyAriaValue('aria-valuenow');
}

/**
 * Get Disney+ actual video duration from progress bar.
 */
function getDisneyDuration(): number | null {
  return getDisneyAriaValue('aria-valuemax');
}

// Subtitle config (extracted for testing)
const subtitleConfig = {
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
};

/** Reset cache - for testing */
function resetCache(): void {
  disneyProgressBarCache = null;
  disneyProgressBarLoggedOnce = false;
}

/**
 * Seek to a specific time by clicking on the Disney+ progress bar.
 * Calculates the correct X position based on time/duration ratio.
 * @returns true if seek was initiated, false if progress bar not found
 */
function seekToTime(time: number, duration: number): boolean {
  const progressBar = document.querySelector('progress-bar');
  if (!progressBar?.shadowRoot) {
    console.warn('[StreamKeys] Progress bar or shadow root not found for seek');
    return false;
  }

  // Get the seekable range element - the actual interactive slider
  const seekableRange = progressBar.shadowRoot.querySelector('.progress-bar__seekable-range');
  if (!seekableRange) {
    console.warn('[StreamKeys] Progress bar seekable range not found');
    return false;
  }

  const rect = seekableRange.getBoundingClientRect();
  if (rect.width === 0) {
    console.warn('[StreamKeys] Progress bar has zero width');
    return false;
  }

  // Calculate click position based on time ratio
  const ratio = Math.max(0, Math.min(1, time / duration));
  const clickX = rect.left + ratio * rect.width;
  const clickY = rect.top + rect.height / 2;

  if (__DEV__) {
    Debug.log(`Seeking to ${time}s via timeline click at x=${Math.round(clickX)}`);
  }

  // Use PointerEvent - modern web apps often use pointer events instead of mouse events
  const eventInit: PointerEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true, // Allow event to cross shadow DOM boundary
    clientX: clickX,
    clientY: clickY,
    view: window,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: 1,
  };

  // Dispatch pointer events on the seekable range
  seekableRange.dispatchEvent(new PointerEvent('pointerdown', eventInit));
  seekableRange.dispatchEvent(new PointerEvent('pointerup', { ...eventInit, buttons: 0 }));

  return true;
}

/**
 * Initialize Disney+ handler
 */
function initDisneyHandler(): void {
  Handler.create({
    name: 'Disney+',

    getPlayer: () => document.body.querySelector('disney-web-player'),

    getVideo: getDisneyVideo,

    getPlaybackTime: getDisneyPlaybackTime,

    getDuration: getDisneyDuration,

    getSeekButtons: () => ({
      backward: getShadowRootButton('quick-rewind'),
      forward: getShadowRootButton('quick-fast-forward'),
    }),

    // Disney+ uses MSE where video.currentTime is buffer-relative
    // Seek by clicking native buttons (ignores custom delta, always uses 10s)
    seekByDelta: (_video, delta) => {
      const button =
        delta < 0 ? getShadowRootButton('quick-rewind') : getShadowRootButton('quick-fast-forward');
      button?.click();
    },

    // Seek to specific time by clicking timeline (for position restore)
    seekToTime,

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

    subtitles: subtitleConfig,
  });
}

// Public API
export const DisneyHandler = {
  init: initDisneyHandler,
  /** Internal functions exposed for testing only */
  _test: {
    getPlayer: () => document.body.querySelector('disney-web-player'),
    getVideo: getDisneyVideo,
    getPlaybackTime: getDisneyPlaybackTime,
    getDuration: getDisneyDuration,
    subtitles: subtitleConfig,
    resetCache,
    /** Seek to time by clicking progress bar */
    seekToTime,
  },
};

// Auto-initialize when script is loaded (with guard against double execution)
if (!shouldSkipInit()) {
  DisneyHandler.init();
}
