// Settings access utilities

import type { StreamKeysSettings } from '@/types';

const DEFAULT_SETTINGS: StreamKeysSettings = {
  subtitleLanguages: ['English', 'English [CC]', 'English CC'],
  positionHistoryEnabled: true,
  captureMediaKeys: true,
  customSeekEnabled: false,
  seekTime: 10,
};

/**
 * Get the current settings from the injected global
 */
function getSettings(): StreamKeysSettings {
  return window.__streamKeysSettings || DEFAULT_SETTINGS;
}

/**
 * Get subtitle language preferences
 */
function getSubtitlePreferences(): string[] {
  return getSettings().subtitleLanguages || [];
}

/**
 * Check if position history feature is enabled
 */
function isPositionHistoryEnabled(): boolean {
  return getSettings().positionHistoryEnabled !== false;
}

/**
 * Check if media keys capture is enabled
 */
function isMediaKeysCaptureEnabled(): boolean {
  return getSettings().captureMediaKeys !== false;
}

/**
 * Check if custom seek time is enabled
 */
function isCustomSeekEnabled(): boolean {
  return getSettings().customSeekEnabled === true;
}

/**
 * Get the custom seek time in seconds
 */
function getSeekTime(): number {
  return getSettings().seekTime ?? 10;
}

// Public API
export const Settings = {
  get: getSettings,
  getSubtitlePreferences,
  isPositionHistoryEnabled,
  isMediaKeysCaptureEnabled,
  isCustomSeekEnabled,
  getSeekTime,
};
