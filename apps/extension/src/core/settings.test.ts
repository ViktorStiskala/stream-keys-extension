import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Settings } from './settings';
import {
  DEFAULT_LANGUAGES,
  DEFAULT_POSITION_HISTORY,
  DEFAULT_CAPTURE_MEDIA_KEYS,
  DEFAULT_CUSTOM_SEEK_ENABLED,
  DEFAULT_SEEK_TIME,
  DEFAULT_ENABLED_SERVICES,
} from '@/types';

// Use the shared defaults from @/types
const EXPECTED_DEFAULTS = {
  subtitleLanguages: DEFAULT_LANGUAGES,
  positionHistoryEnabled: DEFAULT_POSITION_HISTORY,
  captureMediaKeys: DEFAULT_CAPTURE_MEDIA_KEYS,
  customSeekEnabled: DEFAULT_CUSTOM_SEEK_ENABLED,
  seekTime: DEFAULT_SEEK_TIME,
  enabledServices: DEFAULT_ENABLED_SERVICES,
};

describe('Settings', () => {
  beforeEach(() => {
    // Clear any existing settings
    delete window.__streamKeysSettings;
  });

  afterEach(() => {
    delete window.__streamKeysSettings;
  });

  describe('default values (no window settings)', () => {
    it('isMediaKeysCaptureEnabled returns true by default', () => {
      expect(Settings.isMediaKeysCaptureEnabled()).toBe(EXPECTED_DEFAULTS.captureMediaKeys);
    });

    it('isCustomSeekEnabled returns false by default', () => {
      expect(Settings.isCustomSeekEnabled()).toBe(EXPECTED_DEFAULTS.customSeekEnabled);
    });

    it('getSeekTime returns 10 by default', () => {
      expect(Settings.getSeekTime()).toBe(EXPECTED_DEFAULTS.seekTime);
    });

    it('isPositionHistoryEnabled returns true by default', () => {
      expect(Settings.isPositionHistoryEnabled()).toBe(EXPECTED_DEFAULTS.positionHistoryEnabled);
    });

    it('getSubtitlePreferences returns default languages', () => {
      expect(Settings.getSubtitlePreferences()).toEqual(EXPECTED_DEFAULTS.subtitleLanguages);
    });
  });

  describe('with custom window settings', () => {
    it('isMediaKeysCaptureEnabled returns false when disabled', () => {
      window.__streamKeysSettings = {
        ...EXPECTED_DEFAULTS,
        captureMediaKeys: false,
      };

      expect(Settings.isMediaKeysCaptureEnabled()).toBe(false);
    });

    it('isCustomSeekEnabled returns true when enabled', () => {
      window.__streamKeysSettings = {
        ...EXPECTED_DEFAULTS,
        customSeekEnabled: true,
      };

      expect(Settings.isCustomSeekEnabled()).toBe(true);
    });

    it('getSeekTime returns custom value', () => {
      const customSeekTime = 30;
      window.__streamKeysSettings = {
        ...EXPECTED_DEFAULTS,
        seekTime: customSeekTime,
      };

      expect(Settings.getSeekTime()).toBe(customSeekTime);
    });

    it('isPositionHistoryEnabled returns false when disabled', () => {
      window.__streamKeysSettings = {
        ...EXPECTED_DEFAULTS,
        positionHistoryEnabled: false,
      };

      expect(Settings.isPositionHistoryEnabled()).toBe(false);
    });

    it('getSubtitlePreferences returns custom languages', () => {
      const customLanguages = ['Czech', 'Slovak'];
      window.__streamKeysSettings = {
        ...EXPECTED_DEFAULTS,
        subtitleLanguages: customLanguages,
      };

      expect(Settings.getSubtitlePreferences()).toEqual(customLanguages);
    });
  });

  describe('edge cases', () => {
    it('getSeekTime returns 0 when seekTime is 0', () => {
      window.__streamKeysSettings = {
        ...EXPECTED_DEFAULTS,
        seekTime: 0,
      };

      // Uses nullish coalescing (??) so 0 is respected, only null/undefined fall back
      expect(Settings.getSeekTime()).toBe(0);
    });

    it('getSubtitlePreferences returns empty array when languages is empty', () => {
      window.__streamKeysSettings = {
        ...EXPECTED_DEFAULTS,
        subtitleLanguages: [],
      };

      expect(Settings.getSubtitlePreferences()).toEqual([]);
    });
  });
});
