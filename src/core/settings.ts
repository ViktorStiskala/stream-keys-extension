// Settings access utilities

import type { StreamKeysSettings } from '@/types';

const DEFAULT_SETTINGS: StreamKeysSettings = {
  subtitleLanguages: ['English', 'English [CC]', 'English CC'],
  positionHistoryEnabled: true,
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

// Public API
export const Settings = {
  get: getSettings,
  getSubtitlePreferences,
  isPositionHistoryEnabled,
};
