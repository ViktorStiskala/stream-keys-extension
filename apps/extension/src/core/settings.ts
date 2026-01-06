// Settings access utilities

import type { StreamKeysSettings } from '@/types';
import {
  DEFAULT_LANGUAGES,
  DEFAULT_POSITION_HISTORY,
  DEFAULT_CAPTURE_MEDIA_KEYS,
  DEFAULT_CUSTOM_SEEK_ENABLED,
  DEFAULT_SEEK_TIME,
  DEFAULT_ENABLED_SERVICES,
} from '@/types';

const DEFAULT_SETTINGS: StreamKeysSettings = {
  subtitleLanguages: DEFAULT_LANGUAGES,
  positionHistoryEnabled: DEFAULT_POSITION_HISTORY,
  captureMediaKeys: DEFAULT_CAPTURE_MEDIA_KEYS,
  customSeekEnabled: DEFAULT_CUSTOM_SEEK_ENABLED,
  seekTime: DEFAULT_SEEK_TIME,
  enabledServices: DEFAULT_ENABLED_SERVICES,
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
